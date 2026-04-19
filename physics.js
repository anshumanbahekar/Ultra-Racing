/* ================================================================
   ULTRA RACING — physics.js
   Physics engine, Track generator, Car defs, Particle system, Audio
   ================================================================ */

// ────────────────────────────────────────────────────────────────
// UTILS
// ────────────────────────────────────────────────────────────────
const U = {
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  dist:(ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay),
  toRad:d=>d*Math.PI/180,
  normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a},
  rand:(a,b)=>a+Math.random()*(b-a),
  formatTime(ms){if(ms<=0||!isFinite(ms))return'--:--.---';const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),f=Math.floor(ms%1000);return`${m}:${String(s).padStart(2,'0')}.${String(f).padStart(3,'0')}`},
  ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])},
  save:(k,v)=>{try{localStorage.setItem('ur_'+k,JSON.stringify(v))}catch(e){}},
  load:(k,d)=>{try{const v=localStorage.getItem('ur_'+k);return v?JSON.parse(v):d}catch(e){return d}},
  createLoop(cb){let run=false,last=0,raf=null;const tick=t=>{if(!run)return;cb(Math.min((t-last)/1000,.05),t);last=t;raf=requestAnimationFrame(tick)};return{start(){if(run)return;run=true;last=performance.now();raf=requestAnimationFrame(tick)},stop(){run=false;if(raf)cancelAnimationFrame(raf)},get running(){return run}}}
};
window.U=U;

// ────────────────────────────────────────────────────────────────
// CAR DEFINITIONS
// ────────────────────────────────────────────────────────────────
const CAR_DEFS = [
  {id:'falcon', name:'FALCON GT',    class:'Sport',    icon:'🚗', color:'#ff2040', bodyColor:'#bb0018', trimColor:'#ff5070',
   stats:{speed:82,handling:75,accel:78,braking:80},
   phys:{mass:1150,maxTorque:355,maxRPM:8500,gearRatios:[3.4,2.2,1.6,1.2,0.9,0.72],tyreGrip:1.0,cornStiff:52000,drag:0.30,brakeTq:2600,latFric:0.93,
     curve:[[0,.1],[1000,.5],[3000,.85],[5500,1],[7000,.9],[8000,.65],[8500,.4]]}},
  {id:'phantom',name:'PHANTOM R',    class:'Hypercar', icon:'🚘', color:'#005aff', bodyColor:'#0030cc', trimColor:'#4090ff',
   stats:{speed:96,handling:70,accel:94,braking:88},
   phys:{mass:980,maxTorque:580,maxRPM:9800,gearRatios:[3.0,2.1,1.5,1.1,0.85,0.68],tyreGrip:0.97,cornStiff:48000,drag:0.27,downforce:1.2,brakeTq:3000,latFric:0.90,
     curve:[[0,.08],[1500,.55],[4000,.90],[6500,1],[8500,.88],[9500,.6],[9800,.3]]}},
  {id:'vortex', name:'VORTEX S',     class:'GT',       icon:'🏎', color:'#ffe000', bodyColor:'#bb9000', trimColor:'#ffee44',
   stats:{speed:88,handling:92,accel:84,braking:92},
   phys:{mass:1080,maxTorque:410,maxRPM:9200,gearRatios:[3.2,2.15,1.58,1.18,0.92,0.74],tyreGrip:1.1,cornStiff:60000,drag:0.29,downforce:0.8,brakeTq:2900,latFric:0.96,
     curve:[[0,.1],[1000,.5],[3500,.88],[5500,.98],[7500,1],[8800,.82],[9200,.5]]}},
  {id:'street', name:'STREET KING',  class:'Street',   icon:'🚙', color:'#00ff88', bodyColor:'#00aa55', trimColor:'#44ffaa',
   stats:{speed:72,handling:80,accel:70,braking:74},
   phys:{mass:1300,maxTorque:280,maxRPM:7500,gearRatios:[3.8,2.6,1.8,1.3,1.0,0.8],tyreGrip:0.95,cornStiff:44000,drag:0.34,brakeTq:2200,latFric:0.88,
     curve:[[0,.12],[800,.55],[2500,.82],[4500,.95],[6000,1],[7000,.82],[7500,.55]]}},
];
window.CAR_DEFS = CAR_DEFS;

// ────────────────────────────────────────────────────────────────
// PHYSICS ENGINE  (Pacejka-based, real car dynamics)
// ────────────────────────────────────────────────────────────────
class CarPhysics {
  constructor(cfg){
    this.mass      = cfg.mass||1200;
    this.inertia   = this.mass*0.35;
    this.curve     = cfg.curve||[[0,.1],[3000,.8],[6000,1],[9000,.5]];
    this.maxRPM    = cfg.maxRPM||9000;
    this.idleRPM   = 800;
    this.gears     = cfg.gearRatios||[3.5,2.4,1.7,1.25,0.95,0.75];
    this.finalDrv  = cfg.finalDrive||3.5;
    this.wRadius   = 0.31;
    this.maxTorque = cfg.maxTorque||380;
    this.brakeTq   = cfg.brakeTq||2500;
    this.drag      = cfg.drag||0.31;
    this.frontArea = 2.1;
    this.downforce = cfg.downforce||0;
    this.tyreGrip  = cfg.tyreGrip||1;
    this.cornStiff = cfg.cornStiff||50000;
    this.latFric   = cfg.latFric||0.92;
    // State
    this.x=0;this.y=0;this.vx=0;this.vy=0;
    this.heading=0;this.steer=0;
    this.rpm=this.idleRPM;this.gear=1;
    this.throttle=0;this.brake=0;this.handbrake=false;
    this.nitro=1;this.usingNitro=false;
    this.damage=1;this.speed=0;
    this.localVx=0;this.localVy=0;this.yawRate=0;
    this.slipAngle=0;this.wheelspin=0;
    this.onGrass=false;
  }

  _tq(rpm){
    const c=this.curve,n=c.length;
    const rn=rpm/this.maxRPM*9000;
    for(let i=0;i<n-1;i++){
      const[r0,t0]=c[i],[r1,t1]=c[i+1];
      if(rn>=r0&&rn<=r1){const f=(rn-r0)/(r1-r0);return(t0+(t1-t0)*f)*this.maxTorque}
    }
    return 0;
  }

  _pacejka(a){
    const C=1.3,B=10,E=0.97,ba=B*a;
    return Math.sin(C*Math.atan(ba-E*(ba-Math.atan(ba))));
  }

  step(dt){
    if(dt<=0||!isFinite(dt))return;
    dt=Math.min(dt,.04);
    const cosH=Math.cos(this.heading),sinH=Math.sin(this.heading);
    this.localVx= this.vx*cosH+this.vy*sinH;
    this.localVy=-this.vx*sinH+this.vy*cosH;
    this.speed=Math.hypot(this.vx,this.vy);

    // RPM
    const wAng=Math.max(0,this.localVx)/this.wRadius;
    const eAng=wAng*this.gears[this.gear-1]*this.finalDrv;
    const desRPM=eAng*60/(2*Math.PI);
    const tgtRPM=U.clamp(desRPM,this.idleRPM,this.maxRPM);
    this.rpm=U.lerp(this.rpm,tgtRPM,Math.min(1,dt*8));

    // Auto shift
    if(this.rpm>this.maxRPM*.84&&this.gear<this.gears.length)this.gear++;
    if(this.rpm<this.maxRPM*.35&&this.gear>1)this.gear--;

    // Drive
    let drv=0;
    if(this.throttle>0){
      const wT=this._tq(this.rpm)*this.throttle*this.gears[this.gear-1]*this.finalDrv;
      drv=wT/this.wRadius;
      const gM=this.onGrass?.4:1,hM=this.handbrake?.2:1;
      const maxT=this.mass*9.81*this.tyreGrip*gM*hM;
      this.wheelspin=Math.max(0,drv-maxT)/maxT;
      drv=Math.min(drv,maxT);
    }else this.wheelspin=0;

    // Nitro
    if(this.usingNitro&&this.nitro>0){drv+=4000;this.nitro=Math.max(0,this.nitro-.18*dt)}
    else this.nitro=Math.min(1,this.nitro+.04*dt*(this.throttle<.3?1:.3));

    // Aero
    const dg=0.5*1.225*this.drag*this.frontArea*this.speed*this.speed;
    const df=0.5*1.225*this.downforce*this.frontArea*this.speed*this.speed;
    const nF=this.mass*9.81+df;

    // Longitudinal
    let fL=drv;
    if(this.localVx>0)fL-=dg+.015*this.mass*9.81;
    if(this.localVx<-.5)fL+=dg;
    if(this.brake>0){
      const bF=this.brakeTq*this.brake/this.wRadius*(this.handbrake?1.4:1);
      fL+=(this.localVx>0?-1:1)*Math.min(bF,Math.abs(this.localVx)*this.mass/dt);
    }

    // Slip angles
    const maxSt=U.toRad(32)*(1-U.clamp(this.speed/120,0,.45));
    this.steer=U.clamp(this.steer,-maxSt,maxSt);
    const vfy=this.localVy+this.yawRate*1.45;
    const vry=this.localVy-this.yawRate*1.20;
    const fSlip=this.speed>.5?Math.atan2(vfy,Math.abs(this.localVx))-this.steer:0;
    const rSlip=this.speed>.5?Math.atan2(vry,Math.abs(this.localVx)):0;
    this.slipAngle=Math.abs(rSlip);

    const gM2=this.onGrass?.35:1;
    const fLat=-this._pacejka(fSlip)*nF*this.latFric*gM2*.5;
    const rLat=this.handbrake?-rSlip*nF*.05:-this._pacejka(rSlip)*nF*this.latFric*gM2*.5;

    const aLong=fL/this.mass;
    const aLat=(fLat+rLat)/this.mass;
    const yawAcc=(fLat*1.45-rLat*1.20)/this.inertia;

    const yD=2.5*(this.onGrass?.4:1);
    this.yawRate+=(yawAcc-this.yawRate*yD)*dt;
    this.heading+=this.yawRate*dt;
    this.localVx+=aLong*dt;
    this.localVy+=aLat*dt;
    if(this.speed<.3&&this.throttle<.05&&this.brake<.05){this.localVx*=.85;this.localVy*=.85}

    this.vx=this.localVx*cosH-this.localVy*sinH;
    this.vy=this.localVx*sinH+this.localVy*cosH;
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    if(this.onGrass){const d=Math.pow(.92,dt*60);this.vx*=d;this.vy*=d}
    this.speed=Math.hypot(this.vx,this.vy);
  }

  applyImpulse(nx,ny,str){
    this.vx+=nx*str/this.mass;this.vy+=ny*str/this.mass;
    this.damage=Math.max(0,this.damage-str*.00004);
  }
  get speedKmh(){return this.speed*3.6}
  get rpmNorm(){return this.rpm/this.maxRPM}
  get forward(){return{x:Math.cos(this.heading),y:Math.sin(this.heading)}}
}
window.CarPhysics=CarPhysics;

// ────────────────────────────────────────────────────────────────
// TRACK GENERATOR
// ────────────────────────────────────────────────────────────────
const CIRCUITS = {
  alpha:{name:'Circuit Alpha', pts:[{x:400,y:200},{x:700,y:150},{x:950,y:200},{x:1100,y:350},{x:1150,y:520},{x:1050,y:680},{x:880,y:730},{x:700,y:700},{x:550,y:780},{x:450,y:900},{x:320,y:920},{x:200,y:820},{x:160,y:650},{x:200,y:480},{x:280,y:350}]},
  beta:{name:'Neon Circuit',   pts:[{x:500,y:150},{x:800,y:120},{x:1050,y:200},{x:1200,y:400},{x:1180,y:650},{x:1000,y:800},{x:780,y:840},{x:600,y:750},{x:480,y:600},{x:350,y:700},{x:200,y:700},{x:120,y:550},{x:160,y:380},{x:300,y:250}]},
  gamma:{name:'Desert Storm',  pts:[{x:500,y:200},{x:750,y:180},{x:950,y:280},{x:1000,y:450},{x:900,y:580},{x:750,y:600},{x:680,y:720},{x:750,y:850},{x:550,y:950},{x:380,y:880},{x:250,y:750},{x:200,y:580},{x:250,y:420},{x:350,y:300}]},
};
window.CIRCUITS=CIRCUITS;

class Track {
  constructor(key='alpha',numLaps=3){
    const cfg=CIRCUITS[key]||CIRCUITS.alpha;
    this.name=cfg.name;this.width=18;this.numLaps=numLaps;
    this.centerline=this._catmullRom(cfg.pts,500);
    const n=this.centerline.length;
    this.tangents=new Array(n);this.normals=new Array(n);
    for(let i=0;i<n;i++){
      const p=this.centerline[(i-1+n)%n],q=this.centerline[(i+1)%n];
      const tx=q.x-p.x,ty=q.y-p.y,l=Math.hypot(tx,ty)||1;
      this.tangents[i]={x:tx/l,y:ty/l};this.normals[i]={x:-ty/l,y:tx/l};
    }
    const hw=this.width/2;
    this.left= this.centerline.map((p,i)=>({x:p.x+this.normals[i].x*hw,y:p.y+this.normals[i].y*hw}));
    this.right=this.centerline.map((p,i)=>({x:p.x-this.normals[i].x*hw,y:p.y-this.normals[i].y*hw}));
    this.start={x:this.centerline[0].x,y:this.centerline[0].y,heading:Math.atan2(this.tangents[0].y,this.tangents[0].x)};
    const xs=this.centerline.map(p=>p.x),ys=this.centerline.map(p=>p.y);
    this.bbox={minX:Math.min(...xs)-60,maxX:Math.max(...xs)+60,minY:Math.min(...ys)-60,maxY:Math.max(...ys)+60};
  }
  _catmullRom(pts,steps){
    const r=[],n=pts.length;
    for(let i=0;i<n;i++){
      const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
      const sub=Math.floor(steps/n);
      for(let s=0;s<sub;s++){
        const t=s/sub,t2=t*t,t3=t2*t;
        r.push({
          x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
          y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
        });
      }
    }
    return r;
  }
  nearest(x,y){
    let best=Infinity,idx=0;
    const step=Math.max(1,Math.floor(this.centerline.length/80));
    for(let i=0;i<this.centerline.length;i+=step){const d=U.dist(x,y,this.centerline[i].x,this.centerline[i].y);if(d<best){best=d;idx=i}}
    for(let di=-step;di<=step;di++){const i=(idx+di+this.centerline.length)%this.centerline.length;const d=U.dist(x,y,this.centerline[i].x,this.centerline[i].y);if(d<best){best=d;idx=i}}
    return{idx,dist:best,prog:idx/this.centerline.length};
  }
  isOnTrack(x,y){return this.nearest(x,y).dist<this.width/2+1.5}
  gridPositions(n){
    const out=[],hw=this.width*.28;
    for(let i=0;i<n;i++){
      const row=Math.floor(i/2),side=i%2===0?1:-1;
      const off=10+row*14,idx=(this.centerline.length-off+this.centerline.length)%this.centerline.length;
      const p=this.centerline[idx],nm=this.normals[idx];
      out.push({x:p.x+nm.x*hw*side,y:p.y+nm.y*hw*side,heading:this.start.heading});
    }
    return out;
  }
}
window.Track=Track;

// ────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM
// ────────────────────────────────────────────────────────────────
class Particle{
  constructor(x,y,vx,vy,life,size,color,type){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.life=life;this.maxLife=life;this.size=size;this.maxSize=size;
    this.color=color;this.type=type;
    this.alpha=1;this.rot=Math.random()*Math.PI*2;this.rotSpd=(Math.random()-.5)*4;
    this.drag=type==='smoke'?.963:type==='spark'?.948:.92;
    this.grav=type==='spark'?.8:type==='debris'?1.2:0;
  }
  update(dt){
    this.x+=this.vx*dt*60;this.y+=this.vy*dt*60;
    this.vx*=this.drag;this.vy*=this.drag;
    if(this.grav)this.vy+=this.grav*dt*.016*60;
    this.rot+=this.rotSpd*dt;this.life-=dt;
    const t=1-this.life/this.maxLife;
    this.alpha=t<.1?t/.1:t>.7?(1-t)/.3:1;
    if(this.type==='smoke')this.size=this.maxSize*(.5+t*1.5);
    return this.life>0;
  }
}

class Particles{
  constructor(){this.list=[];this.MAX=2200}
  _add(p){if(this.list.length<this.MAX)this.list.push(p)}
  exhaust(x,y,h,rpm,thr){
    if(Math.random()>thr*.4+.05)return;
    const bx=-Math.cos(h),by=-Math.sin(h),px=-Math.sin(h),py=Math.cos(h);
    const iv=thr*.7+rpm/9000*.3;
    for(let i=0;i<Math.floor(iv*3)+1;i++){
      const sp=(Math.random()-.5)*.7,sp2=(.3+Math.random()*.5)*iv;
      const g=Math.floor(155+Math.random()*80);
      this._add(new Particle(x+bx*2.5+px*sp,y+by*2.5+py*sp,bx*sp2+px*sp*.3,by*sp2+py*sp*.3,.6+Math.random()*.9,3+Math.random()*5,`rgb(${g},${g},${g})`,'smoke'));
    }
  }
  tyreSmoke(x,y,slip,spin,speed){
    if(slip<.09&&spin<.06)return;if(Math.random()>.55)return;
    const iv=U.clamp((slip*2+spin)*speed/30,0,1);
    this._add(new Particle(x+(Math.random()-.5)*2,y+(Math.random()-.5)*2,(Math.random()-.5)*.4,(Math.random()-.5)*.4-.1,.8+Math.random()*.8,5+iv*12,'rgba(215,205,195,0.7)','smoke'));
  }
  nitroFlame(x,y,h,on){
    if(!on)return;
    const bx=-Math.cos(h),by=-Math.sin(h);
    for(let i=0;i<5;i++){
      const sp=(Math.random()-.5)*.9,spd=1.5+Math.random()*2.2;
      const c=['#00f5ff','#005aff','#8040ff','#ffffff'][Math.floor(Math.random()*4)];
      this._add(new Particle(x+bx*3+(-Math.sin(h))*sp,y+by*3+(Math.cos(h))*sp,bx*spd,by*spd,.1+Math.random()*.12,3+Math.random()*9,c,'nitro'));
    }
  }
  sparks(x,y,nx,ny,str){
    const cnt=Math.floor(str*.05+8);
    for(let i=0;i<cnt;i++){
      const a=Math.atan2(ny,nx)+(Math.random()-.5)*Math.PI,spd=1.5+Math.random()*3;
      const c=['#ffe000','#ff8800','#ffffff','#ff4400'][Math.floor(Math.random()*4)];
      this._add(new Particle(x,y,Math.cos(a)*spd,Math.sin(a)*spd,.3+Math.random()*.5,1+Math.random()*3,c,'spark'));
    }
  }
  dust(x,y,spd){
    if(Math.random()>.3||spd<5)return;
    const b=Math.floor(135+Math.random()*55);
    this._add(new Particle(x+(Math.random()-.5)*3,y+(Math.random()-.5)*3,(Math.random()-.5)*.3,(Math.random()-.5)*.3-.05,.8+Math.random()*.6,7+Math.random()*11,`rgb(${b},${Math.floor(b*.75)},${Math.floor(b*.5)})`,'smoke'));
  }
  celebrate(x,y){
    const cs=['#ff2040','#ffe000','#00f5ff','#ff6a00','#ffffff'];
    for(let i=0;i<90;i++){
      const a=Math.random()*Math.PI*2,spd=1+Math.random()*4;
      this._add(new Particle(x+(Math.random()-.5)*22,y+(Math.random()-.5)*22,Math.cos(a)*spd,Math.sin(a)*spd-2,1.2+Math.random()*1.2,2+Math.random()*7,cs[Math.floor(Math.random()*cs.length)],'spark'));
    }
  }
  update(dt){this.list=this.list.filter(p=>p.update(dt))}
  render(ctx,cam){
    for(const p of this.list){
      const sx=(p.x-cam.x)*cam.z+cam.cx,sy=(p.y-cam.y)*cam.z+cam.cy,sr=p.size*cam.z;
      if(sx<-sr||sx>cam.w+sr||sy<-sr||sy>cam.h+sr)continue;
      ctx.save();ctx.globalAlpha=p.alpha*.9;
      if(p.type==='smoke'||p.type==='exhaust'){
        const g=ctx.createRadialGradient(sx,sy,0,sx,sy,sr);
        g.addColorStop(0,p.color);g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.fill();
      }else if(p.type==='nitro'){
        ctx.shadowColor=p.color;ctx.shadowBlur=sr*3;
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.fill();
      }else{
        ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(.5,sr*.4);
        ctx.shadowColor=p.color;ctx.shadowBlur=4;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx-p.vx*4,sy-p.vy*4);ctx.stroke();
      }
      ctx.restore();
    }
  }
}
window.Particles=Particles;

// ────────────────────────────────────────────────────────────────
// AUDIO ENGINE
// ────────────────────────────────────────────────────────────────
class AudioEngine{
  constructor(){this._ctx=null;this._ok=false;this._muted=false;this._init=false}
  init(){
    if(this._init)return;this._init=true;
    try{
      this._ctx=new(window.AudioContext||window.webkitAudioContext)();
      this._build();this._ok=true;
    }catch(e){console.warn('Audio:',e)}
  }
  _build(){
    const A=this._ctx;
    this._master=A.createGain();this._master.gain.value=.72;this._master.connect(A.destination);
    const comp=A.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(this._master);

    const revBuf=A.createBuffer(2,A.sampleRate*.5,A.sampleRate);
    for(let c=0;c<2;c++){const d=revBuf.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,.7)}
    const rev=A.createConvolver();rev.buffer=revBuf;
    const revG=A.createGain();revG.gain.value=.12;rev.connect(revG);revG.connect(comp);

    // Engine osc
    this._eo=A.createOscillator();this._eo.type='sawtooth';this._eo.frequency.value=80;this._eo.start();
    this._ef=A.createBiquadFilter();this._ef.type='lowpass';this._ef.frequency.value=1200;this._ef.Q.value=.8;
    const dist=A.createWaveShaper();
    const dc=new Float32Array(256);for(let i=0;i<256;i++){const x=i*2/256-1;dc[i]=(Math.PI+200)*x/(Math.PI+200*Math.abs(x))}
    dist.curve=dc;dist.oversample='2x';
    this._eg=A.createGain();this._eg.gain.value=0;
    this._eo.connect(dist);dist.connect(this._ef);this._ef.connect(this._eg);this._eg.connect(comp);this._eg.connect(rev);

    // Engine osc2 harmonic
    this._eo2=A.createOscillator();this._eo2.type='square';this._eo2.frequency.value=160;this._eo2.start();
    const ef2=A.createBiquadFilter();ef2.type='bandpass';ef2.frequency.value=600;ef2.Q.value=2;
    this._eg2=A.createGain();this._eg2.gain.value=0;
    this._eo2.connect(ef2);ef2.connect(this._eg2);this._eg2.connect(comp);

    // Noise (exhaust rumble)
    const nBuf=A.createBuffer(1,A.sampleRate,A.sampleRate);const nd=nBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    this._ns=A.createBufferSource();this._ns.buffer=nBuf;this._ns.loop=true;this._ns.start();
    this._nf=A.createBiquadFilter();this._nf.type='bandpass';this._nf.frequency.value=120;this._nf.Q.value=.5;
    this._ng=A.createGain();this._ng.gain.value=0;
    this._ns.connect(this._nf);this._nf.connect(this._ng);this._ng.connect(comp);

    // Tyre screech
    const sBuf=A.createBuffer(1,A.sampleRate,A.sampleRate);const sd=sBuf.getChannelData(0);for(let i=0;i<sd.length;i++)sd[i]=(Math.random()*2-1)*Math.sin(i/A.sampleRate*8000);
    const ss=A.createBufferSource();ss.buffer=sBuf;ss.loop=true;ss.start();
    const sf=A.createBiquadFilter();sf.type='bandpass';sf.frequency.value=900;sf.Q.value=1.5;
    this._sg=A.createGain();this._sg.gain.value=0;
    ss.connect(sf);sf.connect(this._sg);this._sg.connect(comp);

    // Nitro
    const nit=A.createBuffer(1,A.sampleRate,A.sampleRate);const nitd=nit.getChannelData(0);for(let i=0;i<nitd.length;i++)nitd[i]=Math.random()*2-1;
    const nits=A.createBufferSource();nits.buffer=nit;nits.loop=true;nits.start();
    const nitf=A.createBiquadFilter();nitf.type='highpass';nitf.frequency.value=3000;
    this._nitg=A.createGain();this._nitg.gain.value=0;
    nits.connect(nitf);nitf.connect(this._nitg);this._nitg.connect(comp);

    // Music beat
    this._mG=A.createGain();this._mG.gain.value=.28;this._mG.connect(this._master);
    this._beat();
  }
  _beat(){
    const A=this._ctx;
    const notes=[55,65.4,87.3,73.4,55,73.4,65.4,87.3];let bi=0;
    const BPM=138,step=60/BPM*.5;
    const tick=()=>{
      if(!this._ok)return;const now=A.currentTime;
      if(bi%4===0){const o=A.createOscillator(),g=A.createGain();o.type='sine';o.frequency.setValueAtTime(120,now);o.frequency.exponentialRampToValueAtTime(40,now+.15);g.gain.setValueAtTime(.45,now);g.gain.exponentialRampToValueAtTime(.001,now+.28);o.connect(g);g.connect(this._mG);o.start(now);o.stop(now+.3)}
      if(bi%2!==0){const len=Math.floor(A.sampleRate*.05),b=A.createBuffer(1,len,A.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,4);const s=A.createBufferSource();s.buffer=b;const g=A.createGain();g.gain.value=.12;const f=A.createBiquadFilter();f.type='highpass';f.frequency.value=8000;s.connect(f);f.connect(g);g.connect(this._mG);s.start(now)}
      const o2=A.createOscillator(),g2=A.createGain(),f2=A.createBiquadFilter();o2.type='sawtooth';o2.frequency.value=notes[bi%notes.length];f2.type='lowpass';f2.frequency.value=300;g2.gain.setValueAtTime(.12,now);g2.gain.exponentialRampToValueAtTime(.001,now+step*.7);o2.connect(f2);f2.connect(g2);g2.connect(this._mG);o2.start(now);o2.stop(now+step);
      bi++;setTimeout(tick,step*1000);
    };
    setTimeout(tick,500);
  }
  update(p,dt){
    if(!this._ok||this._muted)return;
    const A=this._ctx,now=A.currentTime,rn=p.rpmNorm;
    const freq=40+rn*rn*285;
    this._eo.frequency.setTargetAtTime(freq,now,.05);
    this._eo2.frequency.setTargetAtTime(freq*2.01,now,.05);
    this._ef.frequency.setTargetAtTime(400+rn*2200,now,.08);
    const ev=(0.12+p.throttle*.26+rn*.13)*(p.speed>.5||p.throttle>.05?1:0);
    this._eg.gain.setTargetAtTime(ev,now,.05);
    this._eg2.gain.setTargetAtTime(ev*.4,now,.05);
    this._ng.gain.setTargetAtTime(.06+rn*.08+p.throttle*.06,now,.06);
    this._nf.frequency.setTargetAtTime(80+rn*120,now,.1);
    this._sg.gain.setTargetAtTime(U.clamp((Math.abs(p.slipAngle)-.1)*1.8+p.wheelspin*.8,0,.4),now,.04);
    this._nitg.gain.setTargetAtTime(p.usingNitro?.35:0,now,.05);
  }
  collision(str){
    if(!this._ok)return;const A=this._ctx,now=A.currentTime;
    const dur=.15+str*.001,len=Math.floor(A.sampleRate*dur),b=A.createBuffer(1,len,A.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.5);
    const s=A.createBufferSource();s.buffer=b;const g=A.createGain();g.gain.value=Math.min(.8,str*.003);
    const f=A.createBiquadFilter();f.type='bandpass';f.frequency.value=400;f.Q.value=.5;
    s.connect(f);f.connect(g);g.connect(this._master);s.start(now);
  }
  resume(){if(this._ctx?.state==='suspended')this._ctx.resume()}
  setMuted(m){this._muted=m;if(this._master)this._master.gain.value=m?0:.72}
}
window.AudioEngine=AudioEngine;
