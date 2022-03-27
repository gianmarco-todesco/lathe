"use strict";


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
    
    for(let i=0;i<=m;i++) {
        if(i*2==m) continue;
        color = (i%5)==0 ? c1 : c2;
        let x = -r+2*r*i/m;        
        line(x,0,-r, x,0,r);
        line(-r,0,x, r,0,x);
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


function smoothStep(t, t0, t1) {
    if(t<t0) return 0;
    else if(t>t1) return 1;
    else return 0.5-0.5*Math.cos(Math.PI*(t-t0)/(t1-t0));
}
function step(t, t0, t1) {
    if(t<t0) return 0;
    else if(t>t1) return 1;
    else return (t-t0)/(t1-t0);
}
function createHemisphere(diameter, scene) {
    let r = diameter/2;
    let nu = 30, nv = 30;
    let vd = new BABYLON.VertexData();
    vd.positions = [];
    vd.normals = [];
    vd.indices = [];
    vd.positions.push(0,r,0);
    vd.normals.push(0,1,0);
    vd.positions.push(0,0,0);
    vd.normals.push(0,-1,0);
    for(let iu=0;iu<nu;iu++) {
        let theta = (iu+1)/nu*Math.PI/2;
        let csTheta = Math.cos(theta), snTheta = Math.sin(theta);
        console.log(csTheta);
        for(let iv=0;iv<nv;iv++) {
            let phi = Math.PI*2*iv/nv;
            let csPhi = Math.cos(phi), snPhi = Math.sin(phi);
            let nx = csPhi*snTheta, ny = csTheta, nz = snPhi*snTheta;
            vd.normals.push(nx,ny,nz);
            vd.positions.push(r*nx,r*ny,r*nz);
        }
    }
    for(let iv=0;iv<nv;iv++) {
        let phi = Math.PI*2*iv/nv;
        let csPhi = Math.cos(phi), snPhi = Math.sin(phi);
        let nx = csPhi, nz = snPhi;
        vd.normals.push(0,-1,0);
        vd.positions.push(r*nx,0,r*nz);
    }
    let k0 = 2, k1 = k0 + nu*nv;

    for(let iv=0;iv<nv;iv++) {
        let iv1 =(iv+1)%nv;
        vd.indices.push(0,k0+iv,k0+iv1);
        for(let iu=0; iu+1<nu; iu++) {
            let k = k0 + iu*nv + iv;
            let k1 = k0 + iu*nv + iv1;
            vd.indices.push(k,k+nv,k1+nv, k, k1+nv, k1);            
        }
        vd.indices.push(1,k1+iv1,k1+iv);
    }
    let mesh = new BABYLON.Mesh('surface', scene);
    vd.applyToMesh(mesh);
    return mesh; 
}
