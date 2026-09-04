/* Scroll-directed camera: one travelling rig, one continuous deceleration.
   Pure sampling functions also let us check continuity without a browser. */
(function (root) {
  'use strict';
  function clamp(v,a,b) { return Math.min(b,Math.max(a,v)); }
  function smooth(v) { v=clamp(v,0,1); return v*v*v*(v*(v*6-15)+10); }
  function mix(a,b,t) { return a+(b-a)*t; }

  // Constant travel becomes a single smooth braking arc. Its velocity and
  // acceleration meet the cruise and final hold without intermediate stops.
  var start=.08, braking=.34, stop=.53, distance=19.1;
  var speed=distance/(braking-start+(stop-braking)/2);
  function carAt(t) {
    if (t <= braking) return -3.5 + speed*(t-start);
    if (t >= stop) return 15.6;
    var u=(t-braking)/(stop-braking);
    return -3.5+speed*(braking-start)+speed*(stop-braking)*(u-u*u*u+u*u*u*u/2);
  }
  function brakeAt(t) {
    var u=clamp((t-braking)/(stop-braking),0,1);
    return 16*u*u*(1-u)*(1-u);
  }

  // Shape-preserving cubic Hermite interpolation. Shared tangents maintain
  // velocity through shot marks; slope limiting prevents macro overshoot.
  function curve(times, values) {
    var n=times.length, d=[], m=[];
    for(var i=0;i<n-1;i++) d[i]=(values[i+1]-values[i])/(times[i+1]-times[i]);
    m[0]=0; m[n-1]=0;
    for(i=1;i<n-1;i++) {
      if(d[i-1]*d[i]<=0) m[i]=0;
      else {
        var h0=times[i]-times[i-1],h1=times[i+1]-times[i];
        var w0=2*h1+h0,w1=h1+2*h0;
        m[i]=(w0+w1)/(w0/d[i-1]+w1/d[i]);
      }
    }
    return function(t) {
      if(t<=times[0]) return values[0];
      if(t>=times[n-1]) return values[n-1];
      var i=1;while(i<n-1&&t>times[i])i++;
      var a=i-1,h=times[i]-times[a],u=(t-times[a])/h,u2=u*u,u3=u2*u;
      return (2*u3-3*u2+1)*values[a]+(u3-2*u2+u)*h*m[a]
        +(-2*u3+3*u2)*values[i]+(u3-u2)*h*m[i];
    };
  }
  function rig(keys) {
    var times=keys.map(function(k){return k[0];});
    var channels=[];
    for(var i=1;i<8;i++) channels.push(curve(times,keys.map(function(k){return k[i];})));
    return function(t) {
      var v=channels.map(function(c){return c(t);});
      return {p:v.slice(0,3),l:v.slice(3,6),f:v[6]};
    };
  }
  var opening=rig([
    [0,     10.60,3.00,0.20,  0,2.20,0, 37],
    [.045,  10.65,3.12,1.40,  0,2.20,0, 37],
    [.085,  10.10,2.95,3.80,  0,1.95,0, 37],
    [.165,   5.40,1.80,7.00,  0,.30,0, 37]
  ]);
  // All vehicle shots share its origin. There is no roadside pass or later
  // catch-up: the dolly is already beside the car when the mark clears.
  var following=rig([
    [.105,  4.40,1.55,6.60,  -.05,.08,0, 36],
    [.175,  4.05,1.30,5.80,   .00,.10,0, 35],
    [.300,  3.10,.95,4.90,    .18,.08,.05, 34],
    [.405,  2.40,.80,3.80,    .48,.12,.18, 33],
    [.495,  2.24,.87,3.40,   1.05,.10,.65, 35],
    [.575,  1.72,.59,2.13,   1.324,.18,.89, 34],
    [.645,  1.51,.44,1.47,   1.324,.22,.90, 34],
    [.690,  1.57,.50,1.59,   1.324,.22,.90, 34],
    [.742,  3.10,1.85,3.65,  1.324,.38,.90, 35]
  ]);
  var gallery=rig([
    [.712,  21.8,3.00,5.8,  20.6,1.15,3.30, 35],
    [.775,  24.3,3.10,6.5,  21.0,1.15,3.50, 33],
    [.818,  23.6,2.30,5.3,  21.0,1.10,3.50, 28],
    [.856,  23.9,2.20,1.75, 21.0,1.16,0.00, 30],
    [.900,  24.0,2.10,-1.9, 21.0,1.06,-3.5, 28],
    [.950,  29.6,4.80,-4.6, 20.8,2.60,-.60, 36],
    [1.001, 33.0,5.20,9.00, 20.6,2.35,0.00, 40]
  ]);
  function blend(a,b,u) {
    return {p:a.p.map(function(v,i){return mix(v,b.p[i],u);}),
      l:a.l.map(function(v,i){return mix(v,b.l[i],u);}), f:mix(a.f,b.f,u)};
  }
  function fitVehicle(shot,t,aspect) {
    if(aspect>=1.78) return shot;
    var compact=smooth((1.62-aspect)/.55);
    var phone=smooth((.95-aspect)/.40);
    // Compact windows and phones use a deliberate partial crop instead of
    // shrinking the entire car. Phones retain a wider lens so both wheels read.
    var compactFov=mix(34,52,phone);
    shot.f=Math.min(mix(70,compactFov,compact),shot.f/Math.pow(aspect/1.78,.55));
    var weight=smooth((t-.09)/.075)*(1-smooth((t-.405)/.115));
    if(!weight) return shot;
    var direction=shot.l.map(function(v,i){return v-shot.p[i];});
    var length=Math.hypot.apply(null,direction);
    direction=direction.map(function(v){return v/length;});
    var right=[-direction[2],0,direction[0]],rn=Math.hypot.apply(null,right);
    right=right.map(function(v){return v/rn;});
    var tangent=Math.tan(shot.f*Math.PI/360)*aspect,extra=0;
    [-2.194,2.531].forEach(function(x){[0,1.117].forEach(function(y){[-1.055,1.058].forEach(function(z){
      var p=[x+shot.carX-shot.p[0],y-shot.p[1],z-shot.p[2]];
      var horizontal=Math.abs(p[0]*right[0]+p[2]*right[2]);
      var depth=p[0]*direction[0]+p[1]*direction[1]+p[2]*direction[2];
      extra=Math.max(extra,horizontal/(tangent*.93)-depth);
    });});});
    extra*=mix(1,mix(.15,.45,phone),compact);
    shot.p=shot.p.map(function(v,i){return v-direction[i]*extra*weight;});
    return shot;
  }
  function sample(t,aspect) {
    t=clamp(t,0,1);
    var shot=following(t),cx=carAt(t);
    shot.p[0]+=cx;shot.l[0]+=cx;
    // Begin revealing the car while the mark is still clearing the lens. The
    // overlap prevents a blank frame and makes the arrival feel continuous.
    if(t<.160) shot=blend(opening(t),shot,smooth((t-.045)/.115));
    if(t>.705) shot=blend(shot,gallery(t),smooth((t-.705)/.070));
    shot.r=0;shot.carX=cx;
    return aspect?fitVehicle(shot,t,aspect):shot;
  }
  var api={sample:sample,carAt:carAt,brakeAt:brakeAt,curve:curve};
  root.PivarionCinematicTrack=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
