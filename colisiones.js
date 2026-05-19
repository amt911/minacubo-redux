import * as THREE from '../libs/three.module.js'
import * as PM from './ParametrosMundo.js'

class Colisiones {
    constructor(autojump, mitad) {

        this.autojump = autojump;
        this.mitad = mitad;

        let bloqueRaroGeom = new THREE.BoxGeometry(1, 1, 1);

        this.bloqueRaro = new THREE.Mesh(bloqueRaroGeom, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));

        //Poner el bloque como invisible
        this.bloqueRaro.visible = false;

        this.clock = new THREE.Clock();

        this.caidaVel = -1;
        this.caidaAcc = -42;
    }

colisionesSuelo(bloques, personaje, boundingBox) {
    for (let i = 0; i < bloques.length; i++) {
            let bV = new THREE.Vector2(bloques[i].x, bloques[i].z);
            let eV = new THREE.Vector2(personaje.position.x, personaje.position.z);

            if (bV.distanceTo(eV) <= 0.8 && Math.abs((personaje.position.x) - (bloques[i].x)) >= 0 && Math.abs((personaje.position.z) - (bloques[i].z)) >= 0) {
                this.bloqueRaro.position.set(bloques[i].x, bloques[i].y, bloques[i].z);
                if (this.detectCollisionCharacterWorld(this.bloqueRaro, boundingBox)) {
                    personaje.position.y = bloques[i].y + personaje.altura / PM.PIXELES_ESTANDAR / 2 - 0.5;
                    boundingBox.position.y = personaje.position.y + (personaje.altura/2) / PM.PIXELES_ESTANDAR;                        
                    this.caidaVel = 0;
                    personaje.puedeSaltar = true;

                    break;
                }
            }
    }
}

colisionesLateral(bloques, vector, velocidad, personaje, boundingBox) {
    for (let i = 0; i < bloques.length; i++) {
            let bV = new THREE.Vector2(bloques[i].x, bloques[i].z);
            let eV = new THREE.Vector2(personaje.position.x, personaje.position.z);

            if (bV.distanceTo(eV) <= 0.8 && Math.abs((personaje.position.x) - (bloques[i].x)) >= 0 && Math.abs((personaje.position.z) - (bloques[i].z)) >= 0) {
                //if (this.position.y - (bloques[i][j].y - 0.5)== 0 || this.position.y - (bloques[i][j].y - 0.5)== -1){
                this.bloqueRaro.position.set(bloques[i].x, bloques[i].y, bloques[i].z);
                if (this.detectCollisionCharacterWorld(this.bloqueRaro, boundingBox) && Math.abs(boundingBox.position.y - bloques[i].y) <= 0.5) {
                    let choqueX = boundingBox.position.x - bloques[i].x;
                    let choqueZ = boundingBox.position.z - bloques[i].z;

                    if (Math.abs(choqueX) > Math.abs(choqueZ)) {
                        let valor = 0.8
                        if (choqueX > -valor && (choqueX >= valor || choqueX <= 0)) {
                            valor = -valor;
                        }
                        personaje.position.x = bloques[i].x + valor;
                        boundingBox.position.x = bloques[i].x + valor;
                    }
                    else {
                        let valor = 0.8
                        if (choqueZ > -valor && (choqueZ >= valor || choqueZ <= 0)) {
                            valor = -valor;
                        }
                        personaje.position.z = bloques[i].z + valor;
                        boundingBox.position.z = bloques[i].z + valor;                           
                    }

                    let aux = new THREE.Vector3(-vector.x, -vector.y, -vector.z)
                    personaje.translateOnAxis(aux.normalize(), velocidad);

                    boundingBox.translateOnAxis(aux, velocidad);
                }
            }
        }
    }


    detectCollisionCharacterWorld(box, boundingBox) {
        boundingBox.geometry.computeBoundingBox();
        box.geometry.computeBoundingBox();
        boundingBox.updateMatrixWorld();
        box.updateMatrixWorld();

        let a = boundingBox.geometry.boundingBox.clone();
        a.applyMatrix4(boundingBox.matrixWorld);

        let b = box.geometry.boundingBox.clone();
        b.applyMatrix4(box.matrixWorld);

        return a.intersectsBox(b);
    }

    update(bloques, personaje, boundingBox, teclasPulsadas, vectorDir, velocidad) {
        let delta = this.clock.getDelta();

        if (personaje.puedeSaltar && teclasPulsadas != null && teclasPulsadas[" "]) {
            this.caidaVel = 10;
            personaje.puedeSaltar = false;
        }

        //console.log(personaje.position);
        personaje.position.y += this.caidaVel * delta;
        boundingBox.position.y += this.caidaVel * delta;
        this.caidaVel += this.caidaAcc * delta;

        if (!this.autojump)
            this.colisionesLateral(bloques, vectorDir, velocidad, personaje, boundingBox);


        this.colisionesSuelo(bloques, personaje, boundingBox);
    }
}

export { Colisiones }