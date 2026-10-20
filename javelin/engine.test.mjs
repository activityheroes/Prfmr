import test from "node:test";
import assert from "node:assert/strict";
import { JavelinRace, JAVELIN_COURSE, THROW_ZONE, GRAVITY } from "./engine.mjs";
import { THROWER_ART, drawThrower } from "./thrower.mjs";

const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function started(gear={}){const r=new JavelinRace(gear);r.press();r.release();return r;}
function to(r,distance,frame=1/120){for(let i=0;i<30000&&r.distance<distance&&!r.terminal&&r.phase!=="flight";i++)r.advance(Math.min(frame,Math.max(0.00001,(distance-r.distance)/Math.max(r.speed,1))));assert.ok(r.distance>=distance||r.terminal);}
function boost(r,index,frame=1/120){const z=r.zones[index];to(r,z.start,frame);r.press();to(r,z.end,frame);r.release();}
function launch(perfect=true,entry=40,exit=43.5,gear={},frame=1/120){const r=started(gear);if(perfect)for(let i=0;i<6;i++)boost(r,i,frame);to(r,entry,frame);r.press();to(r,exit,frame);r.release();assert.equal(r.phase,"flight");return r;}
function finish(r,frame=1/120){while(!r.terminal)r.advance(frame);return r;}

test("javelin approaches automatically and uses six fixed boost strips",()=>{
  const r=started();to(r,5);assert.ok(r.speed>5.5&&r.speed<=6.5);assert.deepEqual(r.zones.map(z=>z.start),[6,12,18,24,30,36]);
  boost(r,0);assert.equal(r.lastAttempt.grade,"Perfect");close(r.speed,6.5*1.15);close(r.momentum,0.8);
  r.advance(0.3);assert.ok(r.speed>6.5);assert.ok(r.momentum>0.76);
});
test("a perfect run-up and release throws farther than an unboosted approach",()=>{
  const good=finish(launch()),baseline=finish(launch(false));
  assert.equal(good.counts.Perfect,6);assert.equal(good.result.releaseGrade,"Perfect");assert.equal(good.result.foul,false);
  assert.ok(good.result.mark>baseline.result.mark+10);assert.ok(good.result.mark>60&&good.result.mark<85);
  assert.equal(good.bestCombo,6);assert.ok(good.peakSpeed<=9);
});
test("throwing uses Cannon gravity with a measured ground crossing",()=>{
  const r=launch();assert.equal(r.world.gravity.y,-GRAVITY);assert.equal(r.body.mass,0.8);
  const {vx,vy,height,x}=r.launch,t=(vy+Math.sqrt(vy*vy+2*GRAVITY*height))/GRAVITY;
  finish(r);close(r.projectile.y,0);close(r.result.mark,r.projectile.x-45);close(r.result.mark,x+vx*t-45,0.12);
  const mark=r.result.mark;r.advance(10);close(r.result.mark,mark);assert.equal(r.press(),false);
});
test("release timing changes angle, power and final distance",()=>{
  const perfect=finish(launch()),early=finish(launch(true,40,41)),late=finish(launch(true,40,44.4));
  assert.ok(early.result.angle<perfect.result.angle);assert.ok(late.result.angle>perfect.result.angle);
  assert.ok(perfect.result.mark>early.result.mark);assert.ok(perfect.result.mark>late.result.mark);
  assert.equal(late.result.releaseGrade,"Great");
});
test("a held or missed throw crossing the foul line records no mark",()=>{
  const r=started();to(r,40);r.press();to(r,45);assert.equal(r.result.foul,true);assert.equal(r.result.mark,null);assert.equal(r.launch,null);
  const missed=started();to(missed,45);assert.equal(missed.result.foul,true);assert.equal(missed.counts.Miss,6);
  assert.equal(missed.events.filter(e=>e==="finish").length,1);
});
test("continuous holds do not collect zones or automatically throw",()=>{
  const r=new JavelinRace();r.press();to(r,45);assert.equal(r.counts.Miss,6);assert.equal(r.result.foul,true);
});
test("canceled throw input cannot accidentally launch or repeat a release",()=>{
  const r=started();to(r,40);r.press();to(r,42);r.cancelInput();r.release();assert.equal(r.launch,null);assert.equal(r.holding,false);
  r.press();to(r,43.5);r.release();assert.ok(r.launch);const launchRecord=r.launch;r.release();r.press();assert.equal(r.launch,launchRecord);
});
test("input cancellation in a blue zone remains a single miss",()=>{
  const r=started();to(r,6);r.press();to(r,8.4);r.cancelInput();r.release();assert.equal(r.counts.Miss,1);assert.equal(r.lastAttempt.score,0);
});
test("30 and 120 FPS produce consistent throw marks and equipment remains effective",()=>{
  const a=finish(launch(true,40,43.5,{},1/30),1/30),b=finish(launch());close(a.result.mark,b.result.mark,0.1);
  const elite=finish(launch(true,40,43.5,{spikes:2,kit:2}));assert.ok(elite.result.mark>b.result.mark);
  assert.equal(JAVELIN_COURSE.distance,45);assert.equal(THROW_ZONE.end,43.5);
});
test("the athlete and carried javelin fit the texture through run-up, windup and follow-through",()=>{
  const art=THROWER_ART;let dots=0;
  const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},fill(){},arc(x,y,r){
    assert.ok(art.x+(x-r)*art.unit>=0&&art.x+(x+r)*art.unit<=art.width&&art.ground+(y-r)*art.unit>=0&&art.ground+(y+r)*art.unit<=art.height,JSON.stringify({x,y,r}));dots++;
  }};
  for(let d=0;d<=45;d+=0.1)drawThrower(ctx,art.x,art.ground,art.unit,{distance:d,phase:d<39.5?"sprint":"line",flightTime:0});
  for(let t=0;t<1;t+=0.02)drawThrower(ctx,art.x,art.ground,art.unit,{distance:43.5,phase:"flight",launch:{},flightTime:t});
  assert.ok(dots>10000);
});
