// Model.js

'use strict';

class Model {
    constructor(gl, name, uSegments = 30, vSegments = 30, k = 0.5) {
        this.gl = gl;
        this.name = name;
        this.uSegments = uSegments; 
        this.vSegments = vSegments;
        this.k = k;    

        this.iVertexBuffer = gl.createBuffer();
        this.iIndexBufferU = gl.createBuffer();
        this.iIndexBufferV = gl.createBuffer();

        this.uIndexCount = 0;
        this.vIndexCount = 0;

        this.initBuffers();
    }

        getSurfacePoint(u, v) {
        // Використовуємо обертання навколо осі Y, щоб парабола була вертикальною.
        // x = r(u) * cos(v)
        // y = h(u) = u
        // z = r(u) * sin(v)

        let r = this.k * u * u; // r(u) - радіус параболи
        let y = u;              // h(u) - висота/глибина

        let x = r * Math.cos(v);
        let z = r * Math.sin(v);

        return [x, y, z];
    }

    initBuffers() {
        let vertices = [];
        let indicesU = [];
        let indicesV = [];
        let indexMap = (i, j) => i * (this.vSegments + 1) + j;

        const u_min = -1.0;
        const u_max = 2.0;
        const du = (u_max - u_min) / this.uSegments;
        const dv = (2 * Math.PI) / this.vSegments;

        // --- генерація вершин (Vertex Buffer) ---
        for (let i = 0; i <= this.uSegments; i++) {
            let u = u_min + i * du;
            for (let j = 0; j <= this.vSegments; j++) {
                let v = j * dv;
                
                // якщо v досягає 2*PI, ми використовуємо v=0, щоб уникнути дублювання
                // останнього стовпчика (однак, для каркасу ми його лишаємо)
                
                let [x, y, z] = this.getSurfacePoint(u, v);
                vertices.push(x, y, z);
            }
        }

        // --- 2. Генерація індексів для U-поліліній (V = const, Меридіани) ---
        // З'єднуємо вершини вздовж напрямку u (по висоті)
        for (let j = 0; j <= this.vSegments; j++) { // Ітерація по V-лініям (Меридіанам)
            for (let i = 0; i < this.uSegments; i++) { // З'єднання точок вздовж U
                let idx1 = indexMap(i, j);
                let idx2 = indexMap(i + 1, j);
                indicesU.push(idx1, idx2);
            }
        }

        // --- 3. Генерація індексів для V-поліліній (U = const, Паралелі) ---
        // З'єднуємо вершини вздовж напрямку v (по обертанню)
        for (let i = 0; i <= this.uSegments; i++) { // Ітерація по U-лініям (Паралелям)
            for (let j = 0; j < this.vSegments; j++) { // З'єднання точок вздовж V
                let idx1 = indexMap(i, j);
                let idx2 = indexMap(i, j + 1);
                indicesV.push(idx1, idx2);
            }
        }

        // завантаження даних у буфери WebGL
 
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iVertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferU);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicesU), this.gl.STATIC_DRAW);
        this.uIndexCount = indicesU.length;
        

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferV);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicesV), this.gl.STATIC_DRAW);
        this.vIndexCount = indicesV.length;

       
        this.count = vertices.length / 3; 
    }

    Draw(shProgram) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iVertexBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribVertex, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribVertex);

        // u (Меридіани)
        this.gl.uniform4fv(shProgram.iColor, [1, 0, 1, 1.0]); 
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferU);
        this.gl.drawElements(this.gl.LINES, this.uIndexCount, this.gl.UNSIGNED_SHORT, 0);

        // v (Паралелі)
        this.gl.uniform4fv(shProgram.iColor, [0.0, 1.0, 0.0, 1.0]);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferV);
        this.gl.drawElements(this.gl.LINES, this.vIndexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}