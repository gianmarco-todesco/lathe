'use strict';

let canvas, engine, scene, camera;

window.addEventListener('DOMContentLoaded', () => {
    // il tag canvas che visualizza l'animazione
    canvas = document.getElementById('c');
    // la rotella del mouse serve per fare zoom e non per scrollare la pagina
    canvas.addEventListener('wheel', evt => evt.preventDefault());
    
    // engine & scene
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    
    // camera
    camera = new BABYLON.ArcRotateCamera('cam', 
            -Math.PI/2,0.7,
            15, 
            new BABYLON.Vector3(0,0,0), 
            scene);
    camera.attachControl(canvas,true);
    camera.wheelPrecision = 50;
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 13*2;            
    
    // luce
    let light1 = new BABYLON.PointLight('light1',new BABYLON.Vector3(0,1,0), scene);
    light1.parent = camera;
    
    // aggiungo i vari oggetti
    populateScene(scene);
    
    // main loop
    engine.runRenderLoop(()=>scene.render());

    // resize event
    window.addEventListener("resize", () => engine.resize());
});


class Surface {
    constructor(curvePts, n, m) {
        this.n = n;
        this.m = m;
        this.positions = new Array(n*m*3).fill();
        this.normals = new Array(n*m*3).fill(0);
        this.uvs = new Array(n*m*2).fill(0);
        this.indices = new Array((n-1)*(m-1)*6).fill(0);
        this.curvePts = curvePts;
        // create indices
        let indices = this.indices;
        let ik = 0;
        for(let i=0; i+1<n; i++) {
            for(let j=0; j+1<m; j++) {
                let k = i*m+j;
                indices[ik] = k;
                indices[ik+1] = k+1;
                indices[ik+2] = k+1+m;
                indices[ik+3] = k;
                indices[ik+4] = k+1+m;
                indices[ik+5] = k+m;
                ik += 6;
            }
        }
        this.computePoints();
        let mesh = this.mesh = new BABYLON.Mesh('surface', scene);
        let vd = new BABYLON.VertexData();
        vd.positions = this.positions;
        vd.normals = this.normals;
        vd.indices = this.indices;        
        vd.applyToMesh(mesh, true);

        let material = mesh.material = new BABYLON.StandardMaterial('mat', scene);
        material.backFaceCulling = false;
        material.twoSidedLighting = true;
        material.specularColor.set(0.3,0.3,0.3);
        material.diffuseColor.set(0.2,0.3,0.7);
    }


    computePoints() {
        let pts = [];
        for(let i=0; i<this.n; i++) {
            let q = (this.curvePts.length-1)*i/this.n;
            let j = Math.floor(q);
            pts.push(BABYLON.Vector3.Lerp(this.curvePts[j], this.curvePts[j+1], q-j));
        }
        let csn = new Array(2*this.m);
        for(let j=0; j<this.m; j++) {
            let phi = 2*Math.PI*j/(this.m-1);
            csn[j*2] = Math.cos(phi);
            csn[j*2+1] = Math.sin(phi);
        }
        let positions = this.positions;
        for(let i=0; i<this.n; i++) {
            let p = pts[i];
            let px = p.x, py = p.y;
            for(let j=0; j<this.m; j++) {
                let x = px * csn[2*j];
                let y = py;
                let z = px * csn[2*j+1];
                let k = (i*this.m+j)*3;
                positions[k] = x;
                positions[k+1] = y;
                positions[k+2] = z;
            }
        }
        BABYLON.VertexData.ComputeNormals(
            positions, this.indices, this.normals);       
    }

    setCurvePts(curvePts) {
        this.curvePts = curvePts;
        this.computePoints();
        this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.positions);
        this.mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, this.normals);    

    }


};




function populateScene() {

    let grid = createGrid(scene);
    grid.isPickable = false;
    
    let srf = new Surface([
        new BABYLON.Vector3(1,0,0),
        new BABYLON.Vector3(2,1.25,0),
        new BABYLON.Vector3(2,3.75,0),
        new BABYLON.Vector3(1,5,0)
    ], 50,50);
    srf.mesh.isPickable = false;
    window.srf = srf;

    let dot = BABYLON.MeshBuilder.CreateSphere('dot', {diameter:0.3}, scene);
    dot.isPickable = false;

    window.dot = dot;

    let plane = BABYLON.MeshBuilder.CreatePlane('plane', {
        size:4
    }, scene);
    plane.position.x = 2;
    let material = plane.material = new BABYLON.StandardMaterial('plane-mat', scene);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;

    let actionManager = new BABYLON.ActionManager(scene);
    plane.actionManager = actionManager;

    /*
    actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOverTrigger,
            (e) => {
                console.log("PointerOver", e);
            }
        )
    );

    actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOutTrigger,
            (e) => {
                console.log("PointerOver", e);
            }
        )
    );
    */

    dot.isVisible = false;

    let pointerDown = false;
    let pts = [];

    function onPointerDown(pointerInfo) {
        console.log(pointerInfo)
        if(pointerInfo.pickInfo.pickedMesh == plane) {
            pointerDown = true;
            console.log("detach")
            camera.inputs.attached.pointers.detachControl()
            dot.position.copyFrom(pointerInfo.pickInfo.pickedPoint)
            pts = [pointerInfo.pickInfo.pickedPoint.clone()];
        }
    }


    function onPointerUp(pointerInfo) {
        if(pointerDown)
        {
            pointerDown = false;
            camera.inputs.attached.pointers.attachControl();
            BABYLON.MeshBuilder.CreateTube('a',{path:pts, radius:0.1},scene)
        }
        if(pointerInfo.pickInfo && pointerInfo.pickInfo.pickedPoint) {
            
            dot.position.copyFrom(pointerInfo.pickInfo.pickedPoint)
        }
    }
    function onPointerMove(pointerInfo) {
        if(pointerInfo.pickInfo.pickedMesh == plane) {
            dot.isVisible = true;
            dot.position.copyFrom(pointerInfo.pickInfo.pickedPoint)
            if(pointerDown) {
                pts.push(pointerInfo.pickInfo.pickedPoint.clone())
                if(pts.length>=4) {
                    srf.setCurvePts(pts);
                    console.log(pts)
                }    
            }
        } else {
            dot.isVisible = false;
        }

        if(pointerInfo.pickInfo && pointerInfo.pickInfo.pickedPoint) {
            
            dot.position.copyFrom(pointerInfo.pickInfo.pickedPoint)
        }
    }

    scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                onPointerDown(pointerInfo);
                break;
            case BABYLON.PointerEventTypes.POINTERUP:
                onPointerUp(pointerInfo);
                break;
            case BABYLON.PointerEventTypes.POINTERMOVE:
                onPointerMove(pointerInfo);
                break;
            case BABYLON.PointerEventTypes.POINTERWHEEL:
                console.log("POINTER WHEEL");
                break;
            case BABYLON.PointerEventTypes.POINTERPICK:
                console.log("POINTER PICK");
                break;
            case BABYLON.PointerEventTypes.POINTERTAP:
                console.log("POINTER TAP");
                break;
            case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
                console.log("POINTER DOUBLE-TAP");
                break;
        }
    });

    //torus.material = new BABYLON.StandardMaterial('mat',scene);
    //torus.material.diffuseColor.set(0.8,0.4,0.1);

    scene.registerBeforeRender(() => {
        let t = performance.now() * 0.001;
        //torus.rotation.x = t;
    });
}