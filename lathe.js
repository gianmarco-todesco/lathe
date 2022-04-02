'use strict';

let canvas, engine, scene, camera;

const colors = [
    BABYLON.Color3.FromHexString("#2E6D9E"),
    BABYLON.Color3.FromHexString("#546A7B"),
    BABYLON.Color3.FromHexString("#9EA3B0"),
    BABYLON.Color3.FromHexString("#FAE1DF"),
    BABYLON.Color3.FromHexString("#E4C3AD"),
    BABYLON.Color3.FromHexString("#B86E3D")
];

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
            -1.016, 1.214,
            22, 
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
        if(d<0.2) return;
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
    constructor(curve, n, m, color) {
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
        material.diffuseColor.copyFrom(color);
    }


    computePoints() {
        let pts = [];
        for(let i=0; i<this.n; i++) {
            let p = this.curve.getPoint(i/(this.n-1));
            pts.push(p);
        }
        let csn = new Array(2*this.m);
        for(let j=0; j<this.m; j++) {
            let phi = 1.5*Math.PI*j/(this.m-1);
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
        this.currentColor = colors[0];
        this.strokeMaterial = new BABYLON.StandardMaterial('stroke-mat', scene);
        this.strokeMaterial.specularColor.set(0,0,0);
        this.strokeMaterial.diffuseColor.set(0.2,0.2,0.2);
        

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
            let strokePts = [];
            const m = 200;
            for(let i=0; i<m; i++) strokePts.push(stroke.curve.getPoint(i/(m-1)));
            
            if(!stroke.tube) {
                stroke.tube = BABYLON.MeshBuilder.CreateTube('a', {
                    path : strokePts,
                    radius : 0.01,
                    updatable : true
                },scene);
                stroke.tube.material = this.strokeMaterial;
            } else  {
                stroke.tube = BABYLON.MeshBuilder.CreateTube('a', {
                    instance: stroke.tube,
                    path : strokePts
                });
            }
            

            if(!stroke.dots) {
                stroke.dots = [];
                let sphere = BABYLON.MeshBuilder.CreateSphere('dot', {diameter:0.06}, scene );
                sphere.position.copyFrom(stroke.curve.pts[0]);
                sphere.material = this.strokeMaterial;
                stroke.dots.push(sphere);
            }
            while(stroke.curve.pts.length > stroke.dots.length) {
                let dot = stroke.dots[0].createInstance('d');
                dot.position.copyFrom(stroke.curve.pts[stroke.dots.length])
                stroke.dots.push(dot);
            }
    
            if(!stroke.surface) stroke.surface = new Surface(stroke.curve,100,100, this.currentColor);
            else stroke.surface.setCurve(stroke.curve);
            
        }

    }
    
    clear() {
        this.strokes.forEach(stroke => {
            stroke.surface.mesh.dispose();
            stroke.tube.dispose();
            stroke.dots.forEach(dot => dot.dispose());
        })
        this.strokes = [];
    }

    setCurrentColor(c) {
        this.currentColor = c;
        if(this.strokes.length>0) {
            let stroke = this.strokes[this.strokes.length-1];
            if(stroke.surface) stroke.surface.mesh.material.diffuseColor.copyFrom(c);
        }
    }
}

let drawing;


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

    drawing = new Drawing();

    let grid = createGrid(scene);
    grid.isPickable = false;
    
    

    let dot = BABYLON.MeshBuilder.CreateSphere('dot', {diameter:0.1}, scene);
    dot.isPickable = false;

    window.dot = dot;

    // create paper sheet
    let plane = BABYLON.MeshBuilder.CreatePlane('plane', {
        size:8
    }, scene);
    plane.position.x = 4;
    let material = plane.material = new BABYLON.StandardMaterial('plane-mat', scene);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    material.alpha = 0.5;
    material.specularColor.set(0,0,0);
    material.diffuseColor.set(1,1,1);

    let tx = new BABYLON.DynamicTexture('plane-texture', {width:1024,height:1024}, scene);
    material.diffuseTexture = tx;
    let ctx = tx.getContext();
    ctx.fillStyle="white";
    ctx.fillRect(0,0,1024,1024);
    ctx.fillStyle="#eee";
    for(let i=0; i<=1024; i+=64) {
        ctx.fillRect(i-3,0,7,1024);
        ctx.fillRect(0,i-3,1024,7);
    }
    ctx.fillStyle="#ccc";
    for(let i=0; i<=1024; i+=256) {
        ctx.fillRect(i-3,0,7,1024);
        ctx.fillRect(0,i-3,1024,7);
    }
    tx.update();
    
    // GUI
    const guiWidth = 8, guiHeight = 1;
    let guiPlane = BABYLON.MeshBuilder.CreatePlane('plane', {width:guiWidth, height:guiHeight }, scene);
    guiPlane.position.y = 5;
    guiPlane.position.x = guiWidth/2;
    
    window.guiPlane = guiPlane;

    /*
    let dot2 = BABYLON.MeshBuilder.CreateSphere('dot', {diameter:0.2}, scene);
    dot2.parent = guiPlane;
    dot2.position.set(guiWidth/2,guiHeight/2,0);
    let dot3 = dot2.createInstance('dot3');
    dot3.parent = guiPlane;
    dot3.position.set(-guiWidth/2,-guiHeight/2,0);
    */

    
    var guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(guiPlane, 1024, 128);
    window.guiTexture = guiTexture;

    var button = BABYLON.GUI.Button.CreateSimpleButton('x',"X");
    button.width = "128px";
    button.height = "128px";
    button.color = "black";
    button.fontSize = 100;
    button.background = "white";
    guiTexture.addControl(button);
    button.left = (-512 + 64) + "px";
    button.onPointerClickObservable.add(function () {
        drawing.clear();
    }); 

    let checkboxes = [];
    for(let i=0; i<colors.length; i++) {
        var checkbox = new BABYLON.GUI.Checkbox();
        checkbox.width = "128px";
        checkbox.height = "128px";
        checkbox.isChecked = i==0;
        checkbox.color = colors[i].toHexString();
        checkbox.background = colors[i].scale(0.8).toHexString();
        checkbox.onIsCheckedChangedObservable.add(function(value) {
            if(value) {
                for(let j=0; j<checkboxes.length; j++) if(i != j) checkboxes[j].isChecked = false;
                drawing.setCurrentColor(colors[i]);

            }
        });
        checkbox.left = (-512 + 250 + i*140) + "px";
        guiTexture.addControl(checkbox);
        checkboxes.push(checkbox);
    
    }


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
        //console.log(pointerInfo)
        if(pointerInfo.pickInfo.pickedMesh == plane) {
            pointerDown = true;
            //console.log("detach")
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
                //console.log("POINTER WHEEL");
                break;
            case BABYLON.PointerEventTypes.POINTERPICK:
                //console.log("POINTER PICK");
                break;
            case BABYLON.PointerEventTypes.POINTERTAP:
                //console.log("POINTER TAP");
                break;
            case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
                //console.log("POINTER DOUBLE-TAP");
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