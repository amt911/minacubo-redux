// @ts-check
import * as THREE from 'three'
import * as PM from './ParametrosMundo.js'
import { aabbIntersect } from './aabb.js'

const box3ToAABB = (b) => ({
  min: { x: b.min.x, y: b.min.y, z: b.min.z },
  max: { x: b.max.x, y: b.max.y, z: b.max.z },
});

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
    // Solo bloques cuyo TOP queda al nivel de la cabeza o por debajo
    // cuentan como suelo. Las hojas/techos quedan estrictamente por
    // encima → no actuan como suelo (no mas saltos a la copa del arbol).
    // Para overshoot por gravedad la cabeza siempre va ~2u por delante
    // de los pies (altura/PM = 32/16 = 2), asi que esto no rompe el
    // landing en caso de delta grande por frame.
    const headHalf = personaje.altura / PM.PIXELES_ESTANDAR / 2;
    const playerHeadY = personaje.position.y + headHalf;

    for (let i = 0; i < bloques.length; i++) {
            if (bloques[i].y + 0.5 > playerHeadY) continue;

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

                    // No aplicamos translateOnAxis al reves. El snap anterior
                    // ya saca al personaje del bloque; al moverlo ademas hacia
                    // atras se producia jitter: cada frame el input lo empujaba
                    // al bloque, el snap lo movia fuera, el translate lo movia
                    // mas atras todavia → temblor visible al chocar y seguir
                    // andando.
                }
            }
        }
    }


    detectCollisionCharacterWorld(box, boundingBox) {
        boundingBox.geometry.computeBoundingBox();
        box.geometry.computeBoundingBox();
        boundingBox.updateMatrixWorld();
        box.updateMatrixWorld();

        const a = boundingBox.geometry.boundingBox.clone().applyMatrix4(boundingBox.matrixWorld);
        const b = box.geometry.boundingBox.clone().applyMatrix4(box.matrixWorld);

        return aabbIntersect(box3ToAABB(a), box3ToAABB(b));
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