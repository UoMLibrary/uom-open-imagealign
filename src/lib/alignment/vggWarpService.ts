export async function warpImageWithTransform(
    queryBlob: Blob,
    transform: {
        H: number[]
        targetSize: { width: number; height: number }
        resized?: {
            fixed: { scale: number }
            moving: { scale: number }
        }
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

    const vertexSrc = `
attribute vec2 a_position;
varying vec2 v_texCoord;

void main(){

    v_texCoord = vec2(
        a_position.x * 0.5 + 0.5,
        1.0 - (a_position.y * 0.5 + 0.5)
    );

    gl_Position = vec4(a_position,0.0,1.0);
}
`

    const fragmentSrc = `
precision mediump float;

uniform sampler2D u_image;
uniform mat3 u_H;

uniform vec2 u_srcSize;
uniform vec2 u_dstSize;

varying vec2 v_texCoord;

void main(){

    vec2 dst = vec2(
        v_texCoord.x * u_dstSize.x,
        v_texCoord.y * u_dstSize.y
    );

    vec3 p = u_H * vec3(dst,1.0);

    vec2 src = p.xy / p.z;

    vec2 uv = vec2(
        src.x / u_srcSize.x,
        src.y / u_srcSize.y
    );

    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){
        gl_FragColor = vec4(0.0);
        return;
    }

    gl_FragColor = texture2D(u_image,uv);
}
`

    function compile(type: number, src: string) {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)

        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s) || 'shader compile error')
        }

        return s
    }

    const program = gl.createProgram()!

    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc))
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'program link error')
    }

    gl.useProgram(program)

    const quad = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
    ])

    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')

    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap
    )

    function multiply(a: number[], b: number[]) {
        const r = new Array(9).fill(0)

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                for (let k = 0; k < 3; k++) {
                    r[row * 3 + col] += a[row * 3 + k] * b[k * 3 + col]
                }
            }
        }

        return r
    }

    function invert3x3(m: number[]) {

        const a = m[0], b = m[1], c = m[2]
        const d = m[3], e = m[4], f = m[5]
        const g = m[6], h = m[7], i = m[8]

        const det =
            a * (e * i - f * h) -
            b * (d * i - f * g) +
            c * (d * h - e * g)

        return [
            (e * i - f * h) / det,
            (c * h - b * i) / det,
            (b * f - c * e) / det,

            (f * g - d * i) / det,
            (a * i - c * g) / det,
            (c * d - a * f) / det,

            (d * h - e * g) / det,
            (b * g - a * h) / det,
            (a * e - b * d) / det
        ]
    }

    let H = transform.H.slice()

    /* ---------------------------------------------------------
    1. Resize correction
    --------------------------------------------------------- */

    if (transform.resized) {

        const Sf = transform.resized.fixed.scale
        const Sm = transform.resized.moving.scale

        const S_fixed_inv = [
            1 / Sf, 0, 0,
            0, 1 / Sf, 0,
            0, 0, 1
        ]

        const S_moving = [
            Sm, 0, 0,
            0, Sm, 0,
            0, 0, 1
        ]

        H = multiply(multiply(S_fixed_inv, H), S_moving)
    }

    /* ---------------------------------------------------------
    2. Invert for shader (dst → src)
    --------------------------------------------------------- */

    H = invert3x3(H)

    /* ---------------------------------------------------------
    3. Convert centre → top-left coordinates
    --------------------------------------------------------- */

    const fw = transform.targetSize.width
    const fh = transform.targetSize.height

    const mw = bitmap.width
    const mh = bitmap.height

    const T_fixed = [
        1, 0, fw / 2,
        0, 1, fh / 2,
        0, 0, 1
    ]

    const T_moving_inv = [
        1, 0, -mw / 2,
        0, 1, -mh / 2,
        0, 0, 1
    ]

    H = multiply(multiply(T_moving_inv, H), T_fixed)

    H = invert3x3(H)

    const H_gl = new Float32Array([
        H[0], H[3], H[6],
        H[1], H[4], H[7],
        H[2], H[5], H[8]
    ])

    const Hloc = gl.getUniformLocation(program, 'u_H')
    gl.uniformMatrix3fv(Hloc, false, H_gl)

    const texLoc = gl.getUniformLocation(program, 'u_image')
    gl.uniform1i(texLoc, 0)

    const srcSizeLoc = gl.getUniformLocation(program, 'u_srcSize')
    const dstSizeLoc = gl.getUniformLocation(program, 'u_dstSize')

    gl.uniform2f(srcSizeLoc, bitmap.width, bitmap.height)
    gl.uniform2f(dstSizeLoc, canvas.width, canvas.height)

    gl.viewport(0, 0, canvas.width, canvas.height)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    return await new Promise((resolve) =>
        canvas.toBlob(b => resolve(b!), 'image/png')
    )
}