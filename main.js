'use strict';
 
let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let uSlider, vSlider;
let lightPosition = [0, 0, 0];
let lightAngle = 0;
let lightGeometry;
let diffuseMap, specularMap, normalMap;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

function loadTexture(gl, url) {
    return new Promise(resolve => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
            
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            resolve(texture);
        };
        image.src = url;
    });
}


function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTexCoord = -1;
    this.iAttribTangent = -1;
    this.iAttribBitangent = -1;

    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    
    this.iLightPosition = -1;
    this.iViewPosition = -1;
    this.iDrawAsLight = -1;

    this.iDiffuseMap = -1;
    this.iSpecularMap = -1;
    this.iNormalMap = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, 1, 8, 20); 
    let view = spaceball.getViewMatrix();

    lightAngle += 0.01;
    lightPosition = [5 * Math.cos(lightAngle), 2, 5 * Math.sin(lightAngle)];

    shProgram.Use();

    // --- Draw the surface ---
    gl.uniform1i(shProgram.iDrawAsLight, 0); // 0 for false

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);
    let matAccum0 = m4.multiply(rotateToPointZero, view);
    let modelViewMatrix = m4.multiply(translateToPointZero, matAccum0);
    let modelViewProjection = m4.multiply(projection, modelViewMatrix);
    let normalMatrix = m4.transpose(m4.inverse(modelViewMatrix));

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);
    
    // Transform light and view positions to view space
    const lightPosView = m4.transformPoint(view, lightPosition);
    gl.uniform3fv(shProgram.iLightPosition, lightPosView);
    gl.uniform3fv(shProgram.iViewPosition, [0, 0, 0]); // In view space, camera is at the origin

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseMap);
    gl.uniform1i(shProgram.iDiffuseMap, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularMap);
    gl.uniform1i(shProgram.iSpecularMap, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalMap);
    gl.uniform1i(shProgram.iNormalMap, 2);

    surface.Draw(shProgram);

    // --- Draw the light source ---
    gl.uniform1i(shProgram.iDrawAsLight, 1); // 1 for true

    let lightModelMatrix = m4.translation(lightPosition[0], lightPosition[1], lightPosition[2]);
    let lightMvp = m4.multiply(projection, m4.multiply(view, lightModelMatrix));
    
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, lightMvp);

    gl.bindBuffer(gl.ARRAY_BUFFER, lightGeometry.vertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    // Disable other attributes not used for the light
    gl.disableVertexAttribArray(shProgram.iAttribNormal);
    gl.disableVertexAttribArray(shProgram.iAttribTexCoord);
    gl.disableVertexAttribArray(shProgram.iAttribTangent);
    gl.disableVertexAttribArray(shProgram.iAttribBitangent);


    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lightGeometry.indexBuffer);
    gl.drawElements(gl.TRIANGLES, lightGeometry.indexCount, gl.UNSIGNED_SHORT, 0);
}

function createLightGeometry() {
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const vertices = [ -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, 0.1, -0.1, -0.1, -0.1, -0.1, 0.1, -0.1, 0.1, 0.1, -0.1, 0.1, -0.1, -0.1, -0.1, 0.1, -0.1, -0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1, -0.1, -0.1, -0.1, 0.1, -0.1, -0.1, 0.1, -0.1, 0.1, -0.1, -0.1, 0.1, 0.1, -0.1, -0.1, 0.1, 0.1, -0.1, 0.1, 0.1, 0.1, 0.1, -0.1, 0.1, -0.1, -0.1, -0.1, -0.1, -0.1, 0.1, -0.1, 0.1, 0.1, -0.1, 0.1, -0.1, ];
    const indices = [ 0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23, ];
    
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vertexBuffer,
        indexBuffer,
        indexCount: indices.length
    };
}


async function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Phong', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "aVertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "aNormal");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "aTexCoord");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "aTangent");
    shProgram.iAttribBitangent = gl.getAttribLocation(prog, "aBitangent");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "uModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "uModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "uNormalMatrix");
    
    shProgram.iLightPosition = gl.getUniformLocation(prog, "uLightPosition");
    shProgram.iViewPosition = gl.getUniformLocation(prog, "uViewPosition");
    shProgram.iDrawAsLight = gl.getUniformLocation(prog, "uDrawAsLight");

    shProgram.iDiffuseMap = gl.getUniformLocation(prog, "uDiffuseMap");
    shProgram.iSpecularMap = gl.getUniformLocation(prog, "uSpecularMap");
    shProgram.iNormalMap = gl.getUniformLocation(prog, "uNormalMap");


    const uSegments = parseInt(uSlider.value);
    const vSegments = parseInt(vSlider.value);
    surface = new Model(gl, 'Surface', uSegments, vSegments);
    lightGeometry = createLightGeometry();
    
    const texturePromises = [
        loadTexture(gl, 'images/diffuse.jpg'),
        loadTexture(gl, 'images/specular.jpg'),
        loadTexture(gl, 'images/normal.jpg'),
    ];

    const textures = await Promise.all(texturePromises);
    diffuseMap = textures[0];
    specularMap = textures[1];
    normalMap = textures[2];

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function redraw() {
    const uSegments = parseInt(uSlider.value);
    const vSegments = parseInt(vSlider.value);
    surface = new Model(gl, 'Surface', uSegments, vSegments);
    draw();
}

async function init() {
    uSlider = document.getElementById('u-slider');
    vSlider = document.getElementById('v-slider');

    uSlider.addEventListener('input', redraw);
    vSlider.addEventListener('input', redraw);

    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        await initGL();
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    function animate() {
        draw();
        requestAnimationFrame(animate);
    }
    animate();
}