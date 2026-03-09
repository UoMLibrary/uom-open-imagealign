"use strict";
const setup_gl = (canvas, mode="geometric") => {

    if (mode !== 'geometric' && mode !== 'photometric') {
        throw new Error(`Unsupported mode - ${mode} (Supported: geometric, photometric)`);
    }

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
        throw new Error('WebGL unsupported!');
    }

    /**
     * Creates and compiles a shader.
     *
     * @param {!WebGLRenderingContext} gl The WebGL Context.
     * @param {string} shaderSource The GLSL source code for the shader.
     * @param {number} shaderType The type of shader, VERTEX_SHADER or
     *     FRAGMENT_SHADER.
     * @return {!WebGLShader} The shader.
     */
    function compileShader(gl, shaderSource, shaderType) {
        // Create the shader object
        var shader = gl.createShader(shaderType);

        // Set the shader source code.
        gl.shaderSource(shader, shaderSource);

        // Compile the shader
        gl.compileShader(shader);

        // Check if it compiled
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            // Something went wrong during compilation; get the error
            const error = new Error("could not compile shader:" + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            throw error;
        }

        return shader;
    }

    /**
     * Creates a program from 2 shaders.
     *
     * @param {!WebGLRenderingContext) gl The WebGL context.
     * @param {!WebGLShader} vertexShader A vertex shader.
     * @param {!WebGLShader} fragmentShader A fragment shader.
     * @return {!WebGLProgram} A program.
     */
    function createProgram(gl, vertexShader, fragmentShader) {
    // create a program.
    var program = gl.createProgram();

    // attach the shaders.
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    // link the program.
    gl.linkProgram(program);

    // Check if it linked.
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        // something went wrong with the link; get the error
        throw "program failed to link:" + gl.getProgramInfoLog(program);
    }

    return program;
    }

    const vertexShaderSource = `
    // an attribute is an input to a vertex shader.
    // It will receive data from a buffer
    precision highp float;
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    // Output
    varying vec2 v_texCoord;

    // all shaders have a main function
    void main() {

        // Apply transform and switch to -1 -> +1 space

        // Flip the image vertically so that bottom is y positive
        // Flip y coordinates
        gl_Position = vec4(a_position * vec2(1, -1), 0, 1);

        // pass the texCoord to the fragment shader
        // The GPU will interpolate this value between points.
        v_texCoord = a_texCoord;
    }
    `;

    // Reference implementation
    // - https://www.mathworks.com/matlabcentral/fileexchange/24009-rgb2lab
    // - https://www.mathworks.com/matlabcentral/fileexchange/24010-lab2rgb
    // - https://docs.opencv.org/3.4/de/d25/imgproc_color_conversions.html#color_convert_rgb_lab
    // - https://github.com/opencv/opencv/blob/master/modules/imgproc/src/color_lab.cpp#L121
    const fragmentShaderPhotometricSource = `
        // Fragment shader to do the photometric adjustment
        precision highp float;

        // texture
        uniform sampler2D u_image;

        // Mean and stddev
        uniform vec2 source_meanstddev;
        uniform vec2 target_meanstddev;

        // Note: Column major
        const mat3 rgb2xyz = mat3(0.412453,  0.212671, 0.019334,  0.357580, 0.715160,  0.119193,  0.180423, 0.072169, 0.950227);
        const mat3 xyz2rgb = mat3(3.240479, -0.969256, 0.055648, -1.537150, 1.875991, -0.204043, -0.498535, 0.041556, 1.057311);
        const vec3 zero3 = vec3(0.0, 0.0, 0.0);
        const vec3 one3 = vec3(1.0, 1.0, 1.0);

        const float Xn = 0.950456;
        const float Zn = 1.088754;
        const float T = 0.008856;
        const float T2 = 0.206893;
        const float C = 0.04045;
        const float C2 = 0.0031308;

        float srgb_to_linear(float c) {
            if (c > C) {
                return pow((c + 0.055) / 1.055, 2.4);
            }
            return c / 12.92;
        }

        float linear_to_srgb(float c) {
            if (c > C2) {
                return (pow(c, 1.0 / 2.4) * 1.055) - 0.055;
            }
            return c * 12.92;
        }

        vec3 srgb_to_linear(vec3 c) {
            return vec3(
                srgb_to_linear(c.r),
                srgb_to_linear(c.g),
                srgb_to_linear(c.b)
            );
        }

        vec3 linear_to_srgb(vec3 c) {
            return vec3(
                linear_to_srgb(c.r),
                linear_to_srgb(c.g),
                linear_to_srgb(c.b)
            );
        }


        float lab_f(float x) {
            if (x > T) {
                return pow(x, 1.0 / 3.0);
            }
            return 7.787*x + (16.0 / 116.0);
        }

        float lab_f_inv(float x) {
            if (x > T2) {
                return pow(x, 3.0);
            }
            return ((x - (16.0 / 116.0)) / 7.787);
        }

        vec3 lab_f(vec3 x) {
            return vec3(lab_f(x.x), lab_f(x.y), lab_f(x.z));
        }

        vec3 rgb2lab(vec3 rgb) {

            // Convert srgb to linear
            vec3 rgb_linear = srgb_to_linear(rgb);

            // Convert to XYZ
            vec3 xyz = rgb2xyz * rgb_linear;

            xyz.x /= Xn;
            xyz.z /= Zn;

            vec3 fxyz = lab_f(xyz);

            // convert to lab
            return vec3(
                xyz.y > T ? ((116.0 * pow(xyz.y, 1.0 / 3.0)) - 16.0) : 903.3 * xyz.y, // L
                500.0*(fxyz.x - fxyz.y), // a
                200.0*(fxyz.y - fxyz.z)  // b
            );
        }

        vec3 lab2rgb(vec3 lab) {
            float fy = pow(((lab.x + 16.0) / 116.0), 3.0);
            bool fy_greater_than_t = fy > T;
            if (!fy_greater_than_t) {
                fy = lab.x / 903.3;
            }
            float Y = fy;

            // Convert it to fy for other components
            fy = lab_f(fy);

            //compute X
            float fx = lab.y / 500.0 + fy;
            float X = lab_f_inv(fx);

            //compute z
            float fz = fy - (lab.z / 200.0);
            float Z = lab_f_inv(fz);

            X *= Xn;
            Z *= Zn;

            vec3 rgb_linear = xyz2rgb * vec3(X, Y, Z);

            vec3 srgb = linear_to_srgb(rgb_linear);

            return min(one3, max(zero3, srgb));
        }
        vec4 normalize_lab(vec4 color) {
            // Assuming rgb is in 0 - 1 range in texture

            // Convert color to lab
            vec3 lab = rgb2lab(color.rgb);

            // Apply mean correction
            lab.x = target_meanstddev.x + (target_meanstddev.y / source_meanstddev.y) * (lab.x - source_meanstddev.x);
            // lab.x = lab.x * (source_meanstddev.x > target_meanstddev.x ? 0.925 : 1.07);

            // convert color back to rgb
            vec3 rgb = lab2rgb(lab);
            return vec4(rgb, color.a);
        }

        // the texCoords passed in from the vertex shader.
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            if (color.a < 0.01) {
                // Ignore alpha close to zero
                gl_FragColor = color;
                return;
            }
            gl_FragColor = normalize_lab(color);
        }
    `;
    const fragmentShaderSource = `
    // fragment shaders don't have a default precision so we need
    // to pick one. highp means "high precision"
    precision highp float;

    // our texture
    uniform sampler2D u_image;

    // Used to pass in the resolution of the canvas
    uniform vec2 u_resolution;
    uniform vec2 v_resolution;
    uniform mat3 u_matrix;

    const vec2 zero2 = vec2(0.0, 0.0);
    const vec2 one2 = vec2(1.0, 1.0);

    vec2 get_xy(vec2 txy) {
        // Convert to u_resolution and apply matrix transform
        vec3 v_position = vec3(txy * v_resolution, 1);
        vec3 proj_position = u_matrix * v_position;
        vec2 n_position = (proj_position.xy / proj_position.z);
        return (n_position / u_resolution);
    }
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    void main() {
        vec2 rxy = get_xy(v_texCoord);
        if (rxy.x < -0.0 || rxy.y < -0.0 || rxy.x > 1.0 || rxy.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        vec4 color = texture2D(u_image, rxy);
        gl_FragColor = color;
    }
    `;

    const fragmentShaderTPSSource = `
    // fragment shaders don't have a default precision so we need
    // to pick one. highp means "high precision"
    precision highp float;

    // our texture
    uniform sampler2D u_image;

    // Used to pass in the resolution of the canvas
    #define MAX_POINTS 256
    uniform vec4 WH[MAX_POINTS];
    uniform int n_cp;
    uniform int n_cp1;
    uniform int n_cp2;
    uniform vec2 u_resolution;
    uniform vec2 v_resolution;

    vec2 get_xy(vec2 txy) {

        vec2 ctxy = txy * v_resolution + vec2(0.5, 0.5);
        vec2 xy_non_linear = vec2(0, 0);

        for (int i = 0; i < int(MAX_POINTS); ++i) {
            if (i == n_cp + 3) {
                break;
            } else if (i == n_cp + 2) {
                xy_non_linear += WH[i].xy*ctxy.y;
                continue;
            } else if (i == n_cp + 1) {
                xy_non_linear += WH[i].xy*ctxy.x;
                continue;
            } else if (i == n_cp) {
                xy_non_linear += WH[i].xy;
                continue;
            }
            vec2 W = WH[i].xy;
            vec2 H = WH[i].zw;
            float r = distance(H, ctxy);
            float r2 = r * r;

            xy_non_linear += W * r2 * log(r);
        }

        return xy_non_linear / u_resolution;
    }
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    void main() {
        vec2 rxy = get_xy(v_texCoord);
        if (rxy.x < -0.01 || rxy.y < -0.01 || rxy.x > 1.01 || rxy.y > 1.01) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        vec4 color = texture2D(u_image, rxy);
        gl_FragColor = color;
    }
    `;


    // setup GLSL program
    function get_program_info(gl) {
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(
            gl,
            fragmentShaderSource,
            gl.FRAGMENT_SHADER
        );

        const program = createProgram(gl, vertexShader, fragmentShader);
        // look up where the vertex data needs to go.
        return {
            program,
            attributeLocations: {
            positionAttributeLocation: gl.getAttribLocation(program, "a_position"),
            texCoordAttributeLocation: gl.getAttribLocation(program, "a_texCoord"),
            },
            uniformLocations: {
            // lookup uniforms
            resolutionLocation: gl.getUniformLocation(program, "u_resolution"),
            targetresolutionLocation: gl.getUniformLocation(program, "v_resolution"),
            imageLocation: gl.getUniformLocation(program, "u_image"),
            umatrixLocation: gl.getUniformLocation(program, "u_matrix"),
            },
        };
    }
    function get_tps_program_info(gl) {
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(
            gl,
            fragmentShaderTPSSource,
            gl.FRAGMENT_SHADER
        );

        const program = createProgram(gl, vertexShader, fragmentShader);
        // look up where the vertex data needs to go.
        return {
            program,
            attributeLocations: {
                positionAttributeLocation: gl.getAttribLocation(program, "a_position"),
                texCoordAttributeLocation: gl.getAttribLocation(program, "a_texCoord"),
            },
            uniformLocations: {
            // lookup uniforms
                resolutionLocation: gl.getUniformLocation(program, "u_resolution"),
                targetresolutionLocation: gl.getUniformLocation(program, "v_resolution"),
                imageLocation: gl.getUniformLocation(program, "u_image"),
                WLocation: gl.getUniformLocation(program, "WH"),
                ncpLocation: gl.getUniformLocation(program, "n_cp"),
                ncp1Location: gl.getUniformLocation(program, "n_cp1"),
                ncp2Location: gl.getUniformLocation(program, "n_cp2"),
            },
        };
    }
    function get_photometric_program_info(gl) {
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(
            gl,
            fragmentShaderPhotometricSource,
            gl.FRAGMENT_SHADER
        );

        const program = createProgram(gl, vertexShader, fragmentShader);
        // look up where the vertex data needs to go.
        return {
            program,
            attributeLocations: {
                positionAttributeLocation: gl.getAttribLocation(program, "a_position"),
                texCoordAttributeLocation: gl.getAttribLocation(program, "a_texCoord"),
            },
            uniformLocations: {
            // lookup uniforms
                sourcemeanstddevLocation: gl.getUniformLocation(program, "source_meanstddev"),
                targetmeanstddevLocation: gl.getUniformLocation(program, "target_meanstddev"),
                imageLocation: gl.getUniformLocation(program, "u_image"),
            },
        };
    }

    function initBuffers(gl, info) {
    const {
        attributeLocations: {
        positionAttributeLocation,
        texCoordAttributeLocation,
        },
    } = info;

    // Create a buffer and put a single pixel space rectangle in
    // it (2 triangles)
    var positionBuffer = gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Set a rectangle the same size as the image.
    gl.bufferData(
        gl.ARRAY_BUFFER,
        // prettier-ignore
        new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]),
        gl.STATIC_DRAW
    );
    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2; // 2 components per iteration
    var type = gl.FLOAT; // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0; // start at the beginning of the buffer

    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation,
        size,
        type,
        normalize,
        stride,
        offset
    );

    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    // provide texture coordinates for the rectangle.
    gl.bufferData(
        gl.ARRAY_BUFFER,
        // prettier-ignore
        new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ]),
        gl.STATIC_DRAW
    );

    // Tell the attribute how to get data out of texCoordBuffer (ARRAY_BUFFER)
    var size = 2; // 2 components per iteration
    var type = gl.FLOAT; // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0; // start at the beginning of the buffer

    // Turn on the attribute
    gl.enableVertexAttribArray(texCoordAttributeLocation);
    gl.vertexAttribPointer(
        texCoordAttributeLocation,
        size,
        type,
        normalize,
        stride,
        offset
    );
    }

    function loadTexture(gl, image) {
        const texture = gl.createTexture();

        // TexImage2D parameters
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            srcFormat,
            srcType,
            image
        );

        gl.generateMipmap(gl.TEXTURE_2D);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }
    function render_photometric(gl, info, texture, source_meanstddev, target_meanstddev) {
        const {
            uniformLocations: {
                sourcemeanstddevLocation,
                targetmeanstddevLocation,
            }
        } = info;

        // Clear canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // make unit 0 the active texture uint
        // (ie, the unit all other texture commands will affect
        gl.activeTexture(gl.TEXTURE0 + 0);

        // Bind it to texture unit 0' 2D bind point
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Pass uniforms
        gl.uniform2fv(sourcemeanstddevLocation, new Float32Array(source_meanstddev));
        gl.uniform2fv(targetmeanstddevLocation, new Float32Array(target_meanstddev));

        // Draw the rectangle.
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = 6;
        gl.drawArrays(primitiveType, offset, count);
        gl.finish();
    }
    function render(gl, info, texture, iw, ih, H, clear) {
        const {
            uniformLocations: {
                resolutionLocation,
                targetresolutionLocation,
            },
        } = info;

        // Clear the canvas
        if (clear) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        // make unit 0 the active texture uint
        // (ie, the unit all other texture commands will affect
        gl.activeTexture(gl.TEXTURE0 + 0);

        // Bind it to texture unit 0' 2D bind point
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Pass in the canvas resolution so we can convert from
        // pixels to clipspace in the shader

        gl.uniform2f(resolutionLocation, iw, ih);
        gl.uniform2f(targetresolutionLocation, gl.canvas.width, gl.canvas.height);

        if (H.length !== 9) {
            // Convert W to matrix + n_cp
            const _H = new Float32Array(256 * 4);
            _H.fill(0);
            _H.set(H);
            const n_cp = H.length / 4 - 3;
            gl.uniform1i(info.uniformLocations.ncpLocation, n_cp);
            gl.uniform1i(info.uniformLocations.ncp1Location, n_cp + 1);
            gl.uniform1i(info.uniformLocations.ncp2Location, n_cp + 2);
            gl.uniform4fv(
                info.uniformLocations.WLocation,
                _H
            );
        } else {
            gl.uniformMatrix3fv(
                info.uniformLocations.umatrixLocation,
                false,
                H,
            );
        }

        // Draw the rectangle.
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = 6;
        gl.drawArrays(primitiveType, offset, count);
    }

    if (mode === 'photometric') {
        // Photometric mode
        const info = get_photometric_program_info(gl);
        initBuffers(gl, info);
        gl.useProgram(info.program);
        gl.enable(gl.DEPTH_TEST);

        const _render = (_image, source_meanstddev, target_meanstddev) => {
            // Tell WebGL how to convert from clip space to pixels when rendering
            // Assumes correct width and height are set before calling this function
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            const _texture = loadTexture(gl, _image);
            return render_photometric(gl, info, _texture, source_meanstddev, target_meanstddev);
        }
        return _render;
    }
    // Geometric
    // Setup the program
    const info = get_program_info(gl);
    const tps_info = get_tps_program_info(gl);

    initBuffers(gl, info);
    initBuffers(gl, tps_info);

    // turn on depth testing
    gl.enable(gl.DEPTH_TEST);

    // tell webgl to cull faces
    // gl.enable(gl.CULL_FACE);

    const _render = (_image, _H=null, clear=false) => {
        // Tell WebGL how to convert from clip space to pixels when rendering
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const iw = _image.naturalWidth || _image.width;
        const ih = _image.naturalHeight || _image.height;

        const _texture = loadTexture(gl, _image);

        const identity = new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]);
        if (_H === null) {
            gl.useProgram(info.program);
            return render(gl, info, _texture, iw, ih, identity, clear);
        }
        if (_H.length === 9) {
            gl.useProgram(info.program);
            const H = new Float32Array([_H[0], _H[3], _H[6], _H[1], _H[4], _H[7], _H[2], _H[5], _H[8]]);
            return render(gl, info, _texture, iw, ih, H, clear);
        }
        // TPS
        gl.useProgram(tps_info.program);
        return render(gl, tps_info, _texture, iw, ih, _H, clear);
    };

    return _render;
};

if (typeof window !== 'undefined') {
	window.setup_gl = setup_gl;
}