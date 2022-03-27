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

class Curve {
    constructor(p) {
        this.pts = [p];        
        this.curvePts = null;
    }

    addPoint(p) {
        let d = p.subtract(this.pts[this.pts.length-1]).length();        
        if(d<0.1) return;
        this.pts.push(p.clone());
        if(this.pts.length>=4) {
            let curve = BABYLON.Curve3.CreateCatmullRomSpline(this.pts, 10, false);
            this.curvePts = curve.getPoints();
        }
    }

    getPoint(t) {
        let pts = this.curvePts || this.pts;
        let n = pts.length;
        if(n<=2) {
            if(n==1) return pts[0];
            else return BABYLON.Vector3.Lerp(pts[0],pts[1],t);
        } else {
            if(t>=1.0) return pts[n-1];
            let s = (n-1) * t;
            let j = Math.floor(s);
            return BABYLON.Vector3.Lerp(pts[j],pts[j+1],s-j);
        }
    }
}

class Surface {
    constructor(curve, n, m) {
        this.n = n;
        this.m = m;
        this.positions = new Array(n*m*3).fill();
        this.normals = new Array(n*m*3).fill(0);
        this.uvs = new Array(n*m*2).fill(0);
        this.indices = new Array((n-1)*(m-1)*6).fill(0);
        this.curve = curve;
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
            let p = this.curve.getPoint(i/(this.n-1));
            pts.push(p);
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

    setCurve(curve) {
        this.curve = curve;
        this.computePoints();
        this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.positions);
        this.mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, this.normals);    

    }
};

class Drawing {
    constructor() {
        this.strokes = [];

    }    
    startStroke(p) {
        let stroke = { surface : null, curve : new Curve(p) };
        this.stroke = stroke;
        this.strokes.push(stroke);
    }

    lineTo(p) {
        let stroke = this.stroke;
        if(!stroke) return;
        stroke.curve.addPoint(p);
        if(stroke.curve.pts.length>=2) {
            if(!stroke.surface) stroke.surface = new Surface(stroke.curve,100,100);
            else stroke.surface.setCurve(stroke.curve);
        }
    }
    
}

let drawing = new Drawing();


function createGrid(scene) {
    
    let Color4 = BABYLON.Color4;
    let Vector3 = BABYLON.Vector3;
     
    let m = 100;
    let r = 10;
    let pts = [];
    let colors = [];
    let c1 = new Color4(0.7,0.7,0.7,0.5);
    let c2 = new Color4(0.5,0.5,0.5,0.25);
    let cRed   = new Color4(0.8,0.1,0.1);
    let cGreen = new Color4(0.1,0.8,0.1);
    let cBlue  = new Color4(0.1,0.1,0.8);
    
    let color = c1;
    function line(x0,y0,z0, x1,y1,z1) { 
        pts.push([new Vector3(x0,y0,z0), new Vector3(x1,y1,z1)]); 
        colors.push([color,color]); 
    }
    
    
    let r1 = r + 1;
    let a1 = 0.2;
    let a2 = 0.5;
    
    // x axis
    color = cRed;
    line(-r1,0,0, r1,0,0); 
    line(r1,0,0, r1-a2,0,a1);
    line(r1,0,0, r1-a2,0,-a1);
        
    // z axis
    color = cBlue;
    line(0,0,-r1, 0,0,r1); 
    line(0,0,r1, a1,0,r1-a2);
    line(0,0,r1,-a1,0,r1-a2);
    
    // y axis
    color = cGreen;
    line(0,-r1,0, 0,r1,0); 
    line(0,r1,0, a1,r1-a2,0);
    line(0,r1,0,-a1,r1-a2,0);
    line(0,r1,0, 0,r1-a2,a1);
    line(0,r1,0, 0,r1-a2,-a1);
    
    const lines = BABYLON.MeshBuilder.CreateLineSystem(
        "lines", {
                lines: pts,
                colors: colors,
                
        }, 
        scene);
    return lines;    
};



function populateScene() {

    let grid = createGrid(scene);
    grid.isPickable = false;
    
    

    let dot = BABYLON.MeshBuilder.CreateSphere('dot', {diameter:0.3}, scene);
    dot.isPickable = false;

    window.dot = dot;

    let plane = BABYLON.MeshBuilder.CreatePlane('plane', {
        size:8
    }, scene);
    plane.position.x = 4;
    let material = plane.material = new BABYLON.StandardMaterial('plane-mat', scene);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    material.alpha = 0.5;
    material.specularColor.set(0,0,0);
    

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
            let p = pointerInfo.pickInfo.pickedPoint;
            dot.position.copyFrom(p.clone());
            drawing.startStroke(p.clone());
        }
    }


    function onPointerUp(pointerInfo) {
        if(pointerDown)
        {
            pointerDown = false;
            camera.inputs.attached.pointers.attachControl();
            //BABYLON.MeshBuilder.CreateTube('a',{path:pts, radius:0.1},scene)
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
                drawing.lineTo(pointerInfo.pickInfo.pickedPoint.clone());
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