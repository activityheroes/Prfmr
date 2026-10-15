import * as THREE from "../sprint/vendor/three.module.min.js";
import { TrackScene } from "../sprint/track-scene.mjs";
import { JAVELIN_COURSE, THROW_ZONE } from "./engine.mjs";
import { THROWER_ART } from "./thrower.mjs";

const environment = {
  create(track) {
    track.box(260, 0.1, 110, 90, -0.12, 0, "#284c39");
    const runway = track.plate(-50, 50, 2.6, 0, "#65434b", 1);
    const left = track.plate(-50, 50, 0.045, -1.3, "#cec9b8", 1, track.scene, 0.02);
    const right = track.plate(-50, 50, 0.045, 1.3, "#cec9b8", 1, track.scene, 0.02);
    track.marks = Array.from({ length: 13 }, () => track.plate(0, 0.03, 2.6, 0, "#dec6bf", 0.18));
    const sector = new THREE.Group();track.scene.add(sector);
    for (const side of [-1, 1]) {
      const line = track.plate(0, 150, 0.04, 0, "#c3d7bb", 0.6, sector);
      line.position.set(72, 0.015, side * 18);line.rotation.y = -side * Math.atan(0.25);
    }
    for (let mark = 10; mark <= 120; mark += 10) {
      track.plate(mark, 0.035, mark * 0.5, 0, "#87aa86", 0.35, sector);
      const canvas = document.createElement("canvas");canvas.width=128;canvas.height=64;
      const ctx=canvas.getContext("2d");ctx.font="bold 32px monospace";ctx.fillStyle="#d8e6c5";ctx.textAlign="center";ctx.fillText(String(mark),64,42);
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true}));
      label.scale.set(2.6,1.3,1);label.position.set(mark,0.15,mark*0.25+0.8);sector.add(label);
    }
    const target = new THREE.Group();track.scene.add(target);
    track.plate(0,THROW_ZONE.end-THROW_ZONE.start,1.2,0,"#d8aa40",0.55,target,0.04);
    track.plate(-0.035,0.07,1.35,0,"#fff0b0",1,target,0.05);
    track.plate(THROW_ZONE.end-THROW_ZONE.start-0.035,0.07,1.35,0,"#ffffff",1,target,0.05);
    for(let i=0;i<15;i++)track.box(0.8,0.3,0.65,i*3-12,0.1,-5,i%3?"#426950":"#92786b");
    return race=>{
      const end=JAVELIN_COURSE.distance-race.distance;
      runway.position.x=left.position.x=right.position.x=end-25;sector.position.x=end;
      target.position.x=THROW_ZONE.start-race.distance;
    };
  },
  finish(track,parent){track.plate(0,0.15,2.8,0,"#ff7f86",1,parent,0.06);}
};

export class JavelinScene extends TrackScene {
  constructor(canvas) {
    super(canvas,{course:JAVELIN_COURSE,athlete:THROWER_ART,environment});
    const positions=[],colors=[];
    for(let i=0;i<=22;i++){
      positions.push(-2.6+i*2.6/22,0,0);
      const c=new THREE.Color(i===22?"#f8ffe9":i>=8&&i<=11?"#ff7f86":"#ffe19a");colors.push(c.r,c.g,c.b);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    const dotCanvas=document.createElement("canvas");dotCanvas.width=dotCanvas.height=16;
    const dotContext=dotCanvas.getContext("2d");dotContext.fillStyle="#ffffff";dotContext.beginPath();dotContext.arc(8,8,7,0,Math.PI*2);dotContext.fill();
    this.javelin=new THREE.Points(geometry,new THREE.PointsMaterial({vertexColors:true,map:new THREE.CanvasTexture(dotCanvas),alphaTest:0.2,size:2.2,sizeAttenuation:false,depthTest:false}));
    this.javelin.renderOrder=8;this.scene.add(this.javelin);
    this.trail=[];
    for(let i=0;i<22;i++){
      const dot=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,4),new THREE.MeshBasicMaterial({color:"#e4b955",transparent:true,opacity:0.4}));this.scene.add(dot);this.trail.push(dot);
    }
    this.landing=this.plate(0,0.12,1.8,0,"#ffd473",1,this.scene,0.06);this.landing.visible=false;
  }
  resize(width,height){super.resize(width,height);this.frameCamera(null);}
  frameCamera(race){
    const flying=!!race?.launch,small=this.width<650;
    const t=flying?Math.min(1,race.flightTime/0.45):0;
    const x=flying?(race.projectile.x-race.distance)*t+1.8*(1-t):small?1.4:3.2;
    const y=flying?race.projectile.y*0.55:1.3;
    const span=Math.max(flying?small?18:28:small?8.8:17.2,this.width/this.height*(flying?12:6.2));
    const h=span/(this.width/this.height)/2;
    this.camera.position.set(x+8,y+10,20);this.camera.lookAt(x,y,0);
    this.camera.left=-span/2;this.camera.right=span/2;this.camera.top=h;this.camera.bottom=-h;this.camera.updateProjectionMatrix();
  }
  render(race){
    this.frameCamera(race);
    this.javelin.visible=!!race.launch;
    this.landing.visible=!!race.result&&!race.result.foul;
    if(race.launch){
      this.javelin.position.set(race.projectile.x-race.distance,race.projectile.y+0.02,0);
      this.javelin.rotation.z=race.projectile.angle;
      this.landing.position.x=race.projectile.x-race.distance;
    }
    this.trail.forEach((dot,i)=>{
      const t=race.flightTime-i*0.06;
      dot.visible=!!race.launch&&t>0&&!race.terminal;
      if(dot.visible){
        dot.position.set(race.launch.x+race.launch.vx*t-race.distance,Math.max(0.05,race.launch.height+race.launch.vy*t-9.81*t*t/2),0);
        dot.material.opacity=(1-i/this.trail.length)*0.28;
      }
    });
    super.render(race);
  }
}
