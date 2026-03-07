export async function warpImageWithTransform(
    queryBlob: Blob,
    transform: {
        H: number[]
        targetSize: { width: number; height: number }
    }
): Promise<Blob> {

    const bitmap = await createImageBitmap(queryBlob)

    const canvas = document.createElement('canvas')
    canvas.width = transform.targetSize.width
    canvas.height = transform.targetSize.height

    const gl = canvas.getContext('webgl')

    if (!gl) {
        throw new Error('WebGL not supported')
    }

    // ---------- shaders ----------

    const vertexSrc = `
	attribute vec2 a_position;
	varying vec2 v_texCoord;

	void main() {
		v_texCoord = a_position * 0.5 + 0.5;
		gl_Position = vec4(a_position, 0.0, 1.0);
	}
	`

    const fragmentSrc = `
    precision mediump float;

    uniform sampler2D u_image;
    uniform mat3 u_H;

    uniform vec2 u_srcSize;
    uniform vec2 u_dstSize;

    varying vec2 v_texCoord;

    void main() {

        // convert normalized coord → destination pixel coord
        vec2 dst = v_texCoord * u_dstSize;

        // apply homography
        vec3 p = u_H * vec3(dst, 1.0);

        vec2 src = p.xy / p.z;

        // convert back to normalized texture coords
        vec2 uv = src / u_srcSize;

        // ---- ADD THE CHECK HERE ----
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0);
            return;
        }

        gl_FragColor = texture2D(u_image, uv);
    }
	`

    function compile(type: number, src: string) {
        const shader = gl.createShader(type)!
        gl.shaderSource(shader, src)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || 'shader compile error')
        }

        return shader
    }

    const program = gl.createProgram()!

    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc))
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'program link error')
    }

    gl.useProgram(program)

    // ---------- quad ----------

    const quad = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
    ])

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // ---------- texture ----------

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap
    )

    // ---------- matrix fix (row-major → column-major) ----------

    const h = transform.H_inv ?? transform.H

    const H = new Float32Array([
        h[0], h[3], h[6],
        h[1], h[4], h[7],
        h[2], h[5], h[8]
    ])

    const Hloc = gl.getUniformLocation(program, 'u_H')
    gl.uniformMatrix3fv(Hloc, false, H)

    // ---------- image sizes ----------

    const srcSizeLoc = gl.getUniformLocation(program, 'u_srcSize')
    const dstSizeLoc = gl.getUniformLocation(program, 'u_dstSize')

    gl.uniform2f(srcSizeLoc, bitmap.width, bitmap.height)
    gl.uniform2f(dstSizeLoc, canvas.width, canvas.height)

    // ---------- draw ----------

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // ---------- output ----------

    return await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
    )
}