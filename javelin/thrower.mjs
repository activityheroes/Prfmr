import { getRunnerPose, STRIDE_METERS } from "../sprint/runner.mjs";
import { clamp } from "../sprint/engine.mjs";
import { blendPose, ease, reactionAge, reactionPose } from "../sprint/finish.mjs";

const TAU = Math.PI * 2;
export function getThrowerPose(race) {
  const thrown = !!race.launch, idle = race.phase === "ready" || thrown || race.terminal;
  const pose = getRunnerPose(race.distance / STRIDE_METERS, 0, idle);
  const windup = race.phase === "line" || thrown ? clamp((race.distance - 39.5) / 3, 0, 1) : 0;
  const follow = thrown ? clamp(race.flightTime / 0.28, 0, 1) : 0;
  const arm = pose.limbs[0];
  arm.elbow = { x: pose.shoulder.x - 1.6 - windup * 0.8 + follow * 3.8, y: pose.shoulder.y - 0.6 + follow * 0.7 };
  arm.hand = { x: pose.shoulder.x - 0.7 - windup * 3.3 + follow * 4.4, y: pose.shoulder.y - 2.6 + follow * 3.2 };
  if (thrown) {
    pose.limbs[0].foot = { ankle: { x: 2.3, y: -0.5 }, heel: { x: 1.8, y: 0 }, toe: { x: 3, y: 0 } };
    pose.limbs[0].knee = { x: 1.7, y: -4.3 };
    pose.limbs[1].foot = { ankle: { x: -3.5, y: -0.5 }, heel: { x: -4, y: 0 }, toe: { x: -2.8, y: 0 } };
    pose.limbs[1].knee = { x: -2.5, y: -4.2 };
  }
  const reacted = race.presentation ? blendPose(pose, reactionPose(getRunnerPose(0, 0, true), reactionAge(race), race.presentation.success), ease(reactionAge(race) / 0.65)) : pose;
  return { ...reacted, spearAngle: -0.06 - windup * 0.4 };
}
export function drawThrower(ctx, x, ground, unit, race) {
  const pose = getThrowerPose(race);
  ctx.save(); ctx.translate(x, ground); ctx.scale(unit, unit);
  const dot = (x,y,color,r=0.255) => { ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,r,0,TAU);ctx.fill(); };
  const bone = (a,b,color,r=0.255,spacing=0.68) => {
    const n=Math.max(1,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/spacing));
    for(let i=0;i<=n;i++)dot(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,color,r);
  };
  const arm=(l,c)=>{bone(pose.shoulder,l.elbow,c);bone(l.elbow,l.hand,c);};
  const leg=(l,c,shoe)=>{bone(pose.hip,l.knee,c);bone(l.knee,l.foot.ankle,c);bone(l.foot.heel,l.foot.toe,shoe,0.29);};
  arm(pose.limbs[1],"#447f72");leg(pose.limbs[1],"#447f72","#ad8141");
  for(let row=0;row<=6;row++){
    const t=row/6;
    for(let col=-1;col<=1;col++)dot(pose.shoulder.x*(1-t)+pose.hip.x*t+col*(0.55-t*0.1),pose.shoulder.y*(1-t)+pose.hip.y*t,col===1?"#e7ffd3":"#b7fa76");
  }
  bone(pose.shoulder,{x:pose.head.x,y:pose.head.y+1.1},"#e7ffd3");
  for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++)if(row*row+col*col<=6)dot(pose.head.x+col*0.61,pose.head.y+row*0.61,row<-1?"#ff7f86":"#f0f5f1",0.27);
  dot(pose.head.x+1.2,pose.head.y-0.3,"#65c9ff",0.3);dot(pose.head.x+1.65,pose.head.y+0.25,"#f0f5f1");
  leg(pose.limbs[0],"#b7fa76","#ffd473");arm(pose.limbs[0],"#e7ffd3");
  if(!race.launch && !race.presentation){
    const grip=pose.limbs[0].hand,point=d=>({x:grip.x+Math.cos(pose.spearAngle)*d,y:grip.y+Math.sin(pose.spearAngle)*d});
    bone(point(-5.8),point(10.5),"#ffd473",0.14,0.45);bone(point(-0.6),point(0.6),"#ff7f86",0.23,0.3);
    const tip=point(10.7);dot(tip.x,tip.y,"#f0f5f1",0.18);
  }
  ctx.restore();
}
export const THROWER_ART = {
  width:512,height:400,x:190,ground:380,unit:16,
  scaleX:5.12,scaleY:4,anchorX:(190+3*16)/512,anchorY:20/400,
  headHeight:3.1,feedbackX:-0.3,shadowStart:-0.9,shadowLength:1.5,planar:true,draw:drawThrower
};

export function getReleaseOrigin(race) {
  const pose = getThrowerPose(race), hand = pose.limbs[0].hand;
  return { x: race.distance + (hand.x + Math.cos(pose.spearAngle) * 10.7 - 3) * 0.16,
    height: 0.08 - (hand.y + Math.sin(pose.spearAngle) * 10.7) * 0.16 };
}
