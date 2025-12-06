'use strict';
 
class Model {
    constructor(gl, name, uSegments = 30, vSegments = 30, k = 0.5) {
        this.gl = gl;
        this.name = name;
        this.uSegments = uSegments;
        this.vSegments = vSegments;
        this.k = k;

        this.iVertexBuffer = gl.createBuffer();
        this.iNormalBuffer = gl.createBuffer();
        this.iTriangleBuffer = gl.createBuffer();

        this.triangleIndexCount = 0;

        this.initBuffers();
    }

    getSurfacePoint(u, v) {
        let r = this.k * u * u;
        let y = u;
        let x = r * Math.cos(v);
        let z = r * Math.sin(v);
        return [x, y, z];
    }

    getAnalyticNormal(u, v) {
        // Partial derivatives
        let du = [2 * this.k * u * Math.cos(v), 1, 2 * this.k * u * Math.sin(v)];
        let dv = [-this.k * u * u * Math.sin(v), 0, this.k * u * u * Math.cos(v)];

        // Cross product
        let normal = [
            du[1] * dv[2] - du[2] * dv[1],
            du[2] * dv[0] - du[0] * dv[2],
            du[0] * dv[1] - du[1] * dv[0]
        ];

        // Normalization
        let len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (len > 0) {
            normal[0] /= len;
            normal[1] /= len;
            normal[2] /= len;
        }
        return normal;
    }

    initBuffers() {
        let vertices = [];
        let normals = [];
        let triangleIndices = [];
        let indexMap = (i, j) => i * (this.vSegments + 1) + j;

        const u_min = -1.0;
        const u_max = 2.0;
        const du = (u_max - u_min) / this.uSegments;
        const dv = (2 * Math.PI) / this.vSegments;

        for (let i = 0; i <= this.uSegments; i++) {
            let u = u_min + i * du;
            for (let j = 0; j <= this.vSegments; j++) {
                let v = j * dv;
                let [x, y, z] = this.getSurfacePoint(u, v);
                vertices.push(x, y, z);
                let normal = this.getAnalyticNormal(u, v);
                normals.push(normal[0], normal[1], normal[2]);
            }
        }

        for (let i = 0; i < this.uSegments; i++) {
            for (let j = 0; j < this.vSegments; j++) {
                let idx1 = indexMap(i, j);
                let idx2 = indexMap(i + 1, j);
                let idx3 = indexMap(i, j + 1);
                let idx4 = indexMap(i + 1, j + 1);

                triangleIndices.push(idx1, idx2, idx3);
                triangleIndices.push(idx2, idx4, idx3);
            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iVertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iNormalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iTriangleBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleIndices), this.gl.STATIC_DRAW);
        this.triangleIndexCount = triangleIndices.length;
    }

    Draw(shProgram) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iVertexBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribVertex, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribVertex);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iNormalBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribNormal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribNormal);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iTriangleBuffer);
        this.gl.drawElements(this.gl.TRIANGLES, this.triangleIndexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}