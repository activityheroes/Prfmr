import { JavelinRace, JAVELIN_COURSE, THROW_ZONE } from "./engine.mjs";
import { getStats, GEAR, clamp } from "../sprint/engine.mjs";
import { JavelinScene } from "./scene.mjs";

const $=id=>document.getElementById(id),trigger=$("trigger"),dialog=$("result-dialog"),canvas=$("track");
const storageKey="dot-javelin-zones-v1",colors={Perfect:"#d9fbff",Great:"#81f6b6",Good:"#ffd473",Early:"#e8aa62",Late:"#ff7f86",Miss:"#9eabb0"};
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||"{}")||{};}catch{}
const loadout=Object.fromEntries(Object.keys(GEAR).map(key=>[key,clamp(Math.floor(Number(saved.loadout?.[key])||0),0,2)]));
let best=Number.isFinite(saved.best)&&saved.best>0?saved.best:null;
let scene,race,paused=false,lastTime=performance.now(),resultShown=false,attempt=1,audioContext;
try{scene=new JavelinScene(canvas);}catch(error){$("scene-error").hidden=false;console.error(error);}
const input={kind:null,id:null};
const markers=JAVELIN_COURSE.zones.map(z=>{const el=document.createElement("i");el.className="zone-marker";el.style.left=z.start/45*100+"%";el.style.width=(z.end-z.start)/45*100+"%";document.querySelector(".timeline").append(el);return el;});
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify({best,loadout}));}catch{}};
function tone(frequency,duration=0.12){
  if(!$("sound").checked)return;
  try{audioContext||=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});
    const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=frequency;g.gain.setValueAtTime(0.04,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);
  }catch{}
}
const announce=text=>{$("announcer").textContent=text;};
function clearInput(){const id=input.id;input.kind=null;input.id=null;if(id!==null&&trigger.hasPointerCapture?.(id))trigger.releasePointerCapture(id);}
function reset(){
  clearInput();paused=false;resultShown=false;$("pause-panel").hidden=true;if(dialog.open)dialog.close();
  race=new JavelinRace(loadout);lastTime=performance.now();
  const stats=getStats(loadout,JAVELIN_COURSE);
  $("stat-band").textContent=stats.timingTolerance.toFixed(2)+"x edge tolerance";$("stat-blocks").textContent=stats.acceleration.toFixed(2)+" m/s2";
  $("stat-spikes").textContent=stats.maxSpeed.toFixed(1)+" m/s maximum";$("stat-kit").textContent=stats.endurance.toFixed(2)+"x endurance";
  $("kit-label").textContent=Object.values(loadout).some(Boolean)?"CUSTOM LOADOUT":"CLUB LOADOUT";$("attempt").textContent=String(attempt).padStart(2,"0");render();trigger.focus({preventScroll:true});
}
function sync(now=performance.now()){const dt=Math.max(0,(now-lastTime)/1000);lastTime=Math.max(lastTime,now);if(!paused)race.advance(dt);events();}
function events(){
  for(const event of race.events.splice(0)){
    if(event==="start"){tone(550);document.querySelector(".equipment").open=false;announce("Automatic approach. Hold through each blue zone and release at its end.");}
    if(event.type==="zone"){tone(event.result.grade==="Perfect"?990:660);announce("Zone "+event.result.zoneId+": "+event.result.grade);}
    if(event==="line"){clearInput();tone(1100);announce("Throw zone. Press at the gold strip, hold, then release at its white end line before the foul line.");}
    if(event==="throw"){clearInput();tone(1350,0.2);announce("Javelin released. "+race.launch.timing.grade+" timing.");}
    if(event==="finish"){clearInput();showResult();}
  }
}
function activate(kind){if(!scene||paused||race.terminal||input.kind||!race.press())return false;input.kind=kind;events();render();return true;}
function release(kind,canceled=false){if(input.kind!==kind)return;sync();if(canceled)race.cancelInput();else race.release();clearInput();events();render();}
function inside(x,y){const r=trigger.getBoundingClientRect();return Math.hypot(x-r.left-r.width/2,y-r.top-r.height/2)<=r.width/2;}
trigger.addEventListener("pointerdown",e=>{if(e.button!==0||!e.isPrimary||!inside(e.clientX,e.clientY))return;e.preventDefault();sync();if(activate("pointer")){input.id=e.pointerId;trigger.setPointerCapture(e.pointerId);}});
trigger.addEventListener("pointermove",e=>{if(input.kind==="pointer"&&input.id===e.pointerId&&!inside(e.clientX,e.clientY))release("pointer",true);});
trigger.addEventListener("pointerup",e=>{if(input.id===e.pointerId)release("pointer",!inside(e.clientX,e.clientY));});
trigger.addEventListener("pointercancel",e=>{if(input.id===e.pointerId)release("pointer",true);});
trigger.addEventListener("lostpointercapture",()=>{if(input.kind==="pointer")release("pointer",true);});
trigger.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("keydown",e=>{if(e.code!=="Space"||e.repeat||e.target.closest("select,input,summary,button:not(#trigger)"))return;e.preventDefault();sync();activate("keyboard");});
document.addEventListener("keyup",e=>{if(e.code==="Space"&&input.kind==="keyboard"){e.preventDefault();release("keyboard");}});
$("restart").addEventListener("click",reset);$("again").addEventListener("click",()=>{attempt++;reset();});
dialog.addEventListener("cancel",e=>{e.preventDefault();attempt++;reset();});
for(const key of Object.keys(GEAR)){$("gear-"+key).value=String(loadout[key]);$("gear-"+key).addEventListener("change",e=>{if(race.phase!=="ready")return;loadout[key]=Number(e.target.value);persist();reset();});}
function pause(){if(!race.racing||paused)return;sync();if(!race.racing)return;race.cancelInput();clearInput();paused=true;$("pause-panel").hidden=false;events();render();}
window.addEventListener("blur",pause);document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
$("resume").addEventListener("click",()=>{paused=false;lastTime=performance.now();$("pause-panel").hidden=true;trigger.focus({preventScroll:true});});
function showResult(){
  if(resultShown)return;resultShown=true;const r=race.result,old=best;
  const improved=!r.foul&&(best===null||r.mark>best);if(improved){best=r.mark;persist();}
  $("result-tag").textContent=r.foul?"NO MARK":improved?"PERSONAL BEST":"OFFICIAL MARK";
  $("result-title").textContent=r.foul?"Foul":"Javelin";$("result-mark").textContent=r.foul?"FOUL":r.mark.toFixed(2);$("result-unit").hidden=r.foul;
  $("result-detail").textContent=r.foul?"Crossed the foul line without a valid release.":old===null?"Your first measured throw.":improved?(r.mark-old).toFixed(2)+" m beyond your previous best.":(old-r.mark).toFixed(2)+" m short of your personal best.";
  $("result-stats").replaceChildren();
  for(const [name,value]of[["Release timing",r.releaseGrade],["Release angle",r.angle===null?"--":r.angle.toFixed(1)+" deg"],["Launch speed",r.launchSpeed===null?"--":r.launchSpeed.toFixed(1)+" m/s"],["Run-up timing",Math.round(r.rhythmScore)+" / 100"],["Best zone streak",String(r.bestCombo)]]){
    const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=name;dd.textContent=value;row.append(dt,dd);$("result-stats").append(row);
  }
  $("zone-results").replaceChildren();for(const z of r.zones){const li=document.createElement("li");li.textContent="ZONE "+z.zoneId+" / "+z.grade.toUpperCase()+" / "+Math.round(z.score);li.style.color=colors[z.grade];$("zone-results").append(li);}
  announce(r.foul?"Foul. No mark.":"Throw distance "+r.mark.toFixed(2)+" meters.");tone(r.foul?150:880,0.25);dialog.showModal();
}
function render(){
  if(!race)return;scene?.render(race);
  const p=race.phase,flying=!!race.launch,throwing=p==="line",cue=race.cue,z=race.nextZone;
  const recent=race.lastAttempt&&race.time-race.lastAttempt.time<0.8,grade=recent?race.lastAttempt.grade:null;
  const feedback=grade==="Early"?"TOO EARLY":grade==="Late"?"TOO LATE":grade==="Miss"?"MISSED ZONE":grade?grade.toUpperCase()+"!":"";
  $("main-label").textContent=flying?"THROW DISTANCE":"APPROACH TIME";$("main-unit").textContent=flying?"m":"s";
  $("clock").textContent=flying?Math.max(0,race.projectile.x-45).toFixed(2):race.elapsed.toFixed(3).padStart(6,"0");
  $("speed-label").textContent=flying?"HEIGHT":"SPEED";$("speed-unit").textContent=flying?"m":"m/s";$("speed").textContent=(flying?race.projectile.y:race.speed).toFixed(1);
  $("best").textContent=best===null?"--.--":best.toFixed(2);$("distance").textContent=race.distance.toFixed(1)+" M";
  $("progress").style.width=clamp(race.distance/45*100,0,100)+"%";document.querySelector(".timeline").setAttribute("aria-valuenow",String(Math.round(race.distance)));
  $("zone-count").textContent="ZONES "+race.attempts+" / 6";$("meet-label").textContent=flying?"IN FLIGHT":race.combo?"STREAK "+race.combo:"RHYTHM THROW";
  markers.forEach((m,i)=>m.style.background=colors[race.zones[i].result?.grade]??"#65c9ff");$("gear").disabled=p!=="ready";
  trigger.disabled=!scene||flying||race.terminal;trigger.classList.toggle("is-held",race.holding&&!paused);trigger.dataset.mode=throwing||flying?"line":"zone";trigger.dataset.tier=grade?.toLowerCase()??cue;trigger.style.setProperty("--charge","100%");
  $("trigger-main").textContent=p==="ready"?"START\nRUN":race.terminal?"DONE":flying?"IN\nFLIGHT":throwing?"HOLD &\nTHROW":"TAP &\nHOLD";
  $("trigger-top").textContent=p==="ready"?"READY":flying?race.launch.timing.grade.toUpperCase():throwing?cue==="release"?"RELEASE!":race.holding?"DRAW BACK":cue==="press"?"PRESS":"GET READY":({run:"RUNNING",press:"PRESS",hold:"HOLD",release:"RELEASE",lift:"LET GO"})[cue]??"FINISHED";
  $("trigger-bottom").textContent=throwing?"GOLD RELEASE ZONE":flying?race.launch.angle.toFixed(1)+" DEG":race.terminal?"ATTEMPT COMPLETE":z?"ZONE "+z.id+" / 6":"6 BOOST ZONES";
  trigger.setAttribute("aria-label",p==="ready"?"Start approach":throwing?"Hold at the gold zone entry, release at the white line to throw":"Hold through each blue zone and release at its end. Space also controls the athlete.");
  const active=throwing||flying||race.terminal?"line":race.activeHold||cue==="press"?"zone":"run";document.querySelectorAll(".phases li").forEach(li=>li.classList.toggle("active",li.dataset.phase===active));
  $("race-call").textContent=flying?"":p==="ready"?"READY":race.terminal?"FOUL":throwing?cue==="release"?"RELEASE!":race.holding?"DRAW BACK":cue==="press"?"PRESS":"THROW ZONE":recent?feedback:cue==="press"?"PRESS":cue==="release"?"RELEASE":"";
  $("race-call").style.color=throwing?"#ffd473":colors[grade]??"#f0f5f1";$("race-call").className="race-call"+(grade==="Perfect"?" flash":"");
  if(scene){const foot=scene.project(scene.art.feedbackX),scale=scene.height/(scene.camera.top-scene.camera.bottom);$("race-call").style.left=clamp(foot.x,78,scene.width-78)+"px";$("race-call").style.top=Math.max(8,foot.y-scene.art.headHeight*scale-30)+"px";}
  const distance=throwing?(race.holding?THROW_ZONE.end:THROW_ZONE.start)-race.distance:z?(race.activeHold?z.end:z.start)-race.distance:0;
  $("left-label").textContent=flying?"RELEASE ANGLE":throwing?race.holding?"RELEASE IN":"THROW ZONE":race.activeHold?"EXIT IN":"NEXT ZONE";
  $("left-value").innerHTML=(flying?race.launch.angle:Math.max(0,distance)).toFixed(1)+"<span>"+(flying?"DEG":"M")+"</span>";
  $("right-label").textContent=flying?"RELEASE SCORE":"TIMING SCORE";$("right-value").innerHTML=Math.round(flying?race.launch.timing.score:race.rhythmScore)+"<span>/ 100</span>";
  $("phase-note").textContent=throwing?"GOLD ZONE / 40 - 43.5 M":flying?"MEASURED FROM THE FOUL LINE":"45 M RUNWAY";
  $("feedback").style.color=throwing?"#ffd473":colors[grade]??"#65c9ff";
  $("feedback").textContent=race.terminal?race.result.foul?"FOUL / NO MARK":"VALID THROW":flying?race.launch.timing.grade.toUpperCase()+" RELEASE":throwing?race.holding?"HOLD / RELEASE AT WHITE LINE":"GOLD THROW ZONE":p==="ready"?"ON YOUR MARKS":recent?feedback+(race.lastAttempt.boost?" / +"+Math.round(race.lastAttempt.boost*100)+"%":""):race.activeHold?"ZONE "+z.id+" / HOLD ACTIVE":"AUTOMATIC RUN-UP";
}
function fit(){const r=canvas.getBoundingClientRect();scene?.resize(r.width,r.height);}
new ResizeObserver(()=>{fit();render();}).observe(canvas);fit();reset();
function frame(now){sync(now);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
