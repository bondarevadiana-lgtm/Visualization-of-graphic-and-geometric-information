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
        this.iTexCoordBuffer = gl.createBuffer();
        this.iTangentBuffer = gl.createBuffer();
        this.iBitangentBuffer = gl.createBuffer();
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
        return m4.normalize(normal);
    }

    initBuffers() {
        let vertices = [];
        let normals = [];
        let texCoords = [];
        let tangents = [];
        let bitangents = [];
        let triangleIndices = [];
        let indexMap = (i, j) => i * (this.vSegments + 1) + j;

        const u_min = -1.0;
        const u_max = 2.0;
        const du_step = (u_max - u_min) / this.uSegments;
        const dv_step = (2 * Math.PI) / this.vSegments;

        for (let i = 0; i <= this.uSegments; i++) {
            let u = u_min + i * du_step;
            for (let j = 0; j <= this.vSegments; j++) {
                let v = j * dv_step;
                
                let [x, y, z] = this.getSurfacePoint(u, v);
                vertices.push(x, y, z);
                
                texCoords.push(i / this.uSegments, j / this.vSegments);

                // Partial derivatives
                let p_du = [2 * this.k * u * Math.cos(v), 1, 2 * this.k * u * Math.sin(v)];
                let p_dv = [-this.k * u * u * Math.sin(v), 0, this.k * u * u * Math.cos(v)];

                let normal = m4.normalize(m4.cross(p_du, p_dv));
                
                // Gram-Schmidt orthogonalization (prioritize tangent)
                let tangent = m4.normalize(p_du);
                let n_dot_t = m4.dot(normal, tangent);
                let proj = m4.scaleVector(tangent, n_dot_t);
                let ortho_normal = m4.normalize(m4.subtractVectors(normal, proj));
                let bitangent = m4.normalize(m4.cross(ortho_normal, tangent));

                normals.push(ortho_normal[0], ortho_normal[1], ortho_normal[2]);
                tangents.push(tangent[0], tangent[1], tangent[2]);
                bitangents.push(bitangent[0], bitangent[1], bitangent[2]);
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

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iTangentBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(tangents), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iBitangentBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(bitangents), this.gl.STATIC_DRAW);

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

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iTangentBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribTangent, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribTangent);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.iBitangentBuffer);
        this.gl.vertexAttribPointer(shProgram.iAttribBitangent, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(shProgram.iAttribBitangent);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iTriangleBuffer);
        this.gl.drawElements(this.gl.TRIANGLES, this.triangleIndexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}