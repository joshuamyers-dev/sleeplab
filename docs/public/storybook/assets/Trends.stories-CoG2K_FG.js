import{c as l,M as B}from"./iframe-CnI2o-UJ.js";import{T as G}from"./Trends-BYFpcORV.js";import"./preload-helper-Dp1pzeXC.js";import"./GlossaryText-C8CDyE6b.js";import"./index-CofT53Tl.js";import"./index-CeRDCxkJ.js";import"./InfoPopover-CNMkuGbS.js";import"./card-N1AUAA9K.js";import"./utils-2dOUpm6k.js";import"./button-C_rUzKqW.js";import"./aiSummaryCache-BSuJUHZx.js";import"./CartesianChart-CqEBiA-s.js";import"./ReferenceLine-DFyG7Qoo.js";import"./Bar-DZympaB4.js";import"./Line-B0EOESsb.js";const J={...l};function K(u){const a=[],Z=new Date("2023-11-01T12:00:00Z");for(let r=u;r>0;r--){const g=new Date(Z);g.setDate(g.getDate()-r);const $=g.toISOString().split("T")[0];a.push({folder_date:$,session_id:`sess-${r}`,ahi:1.5+Math.random(),central_apnea_index:.2+Math.random()*.5,obstructive_apnea_index:.5+Math.random(),hypopnea_index:.8+Math.random(),apnea_index:.7+Math.random(),arousal_index:5+Math.random()*2,usage_hours:6+Math.random()*2,session_start_hour:22+Math.random(),session_end_hour:6+Math.random(),avg_pressure:10+Math.random()*2,p95_pressure:12+Math.random()*2,avg_leak:5+Math.random()*5,large_leak_minutes:Math.random()>.8?10:0,avg_flow_lim:.1+Math.random()*.1,avg_tidal_vol:450+Math.random()*100,avg_min_vent:6+Math.random(),avg_resp_rate:14+Math.random()*3,min_spo2:90+Math.random()*4,avg_spo2:95+Math.random()*3,avg_pulse:60+Math.random()*10,equipment_age_days:30-r>0?30-r:0})}return a}const Q={total_nights:150,nights_with_data:145,compliance_pct:95,avg_ahi:2.1,avg_pressure:10.5,ahi_trend:[],event_breakdown:{obstructive_apnea:50,hypopnea:120,central_apnea:10}},V={nights:K(30)},U={llm_configured:!0},h={headline:"Therapy is looking well-optimized",therapy_quality:"AHI remains extremely low, and leaks are under control.",high_confidence_observations:["AHI has remained below 2.0 for the past 14 days.","Usage is excellent, averaging 7.5 hours per night."],possible_patterns:["Slight increase in pressure around 3 AM correlates with REM sleep stages."],things_to_review:["Check your mask cushion, as leak has slightly trended up over the past 3 days."],missing_or_uncertain:[],anomalies:[],trend_direction:"stable",flag:"good",cached:!0,error:null},e={getSummary:()=>Promise.resolve(Q),getOverviewStats:()=>Promise.resolve(V),getImportSettings:()=>Promise.resolve(U),getTrendAISummary:()=>Promise.resolve(h)},ue={title:"Pages/Trends",component:G,tags:["autodocs","ai-generated"],decorators:[(u,a)=>(Object.assign(l,J),a.parameters.apiMocks?Object.assign(l,a.parameters.apiMocks):Object.assign(l,e),React.createElement(B,null,React.createElement(u,null)))]},t={parameters:{apiMocks:e}},s={parameters:{apiMocks:{...e,getSummary:()=>new Promise(()=>{}),getOverviewStats:()=>new Promise(()=>{})}}},o={parameters:{apiMocks:{...e,getSummary:()=>Promise.reject(new Error("Failed to load summary statistics from the server."))}}},n={parameters:{apiMocks:{...e,getOverviewStats:()=>Promise.resolve({nights:[]})}}},i={parameters:{apiMocks:{...e,getImportSettings:()=>Promise.resolve({...U,llm_configured:!1})}}},m={parameters:{apiMocks:{...e,getTrendAISummary:()=>new Promise(()=>{})}}},c={parameters:{apiMocks:{...e,getTrendAISummary:()=>Promise.resolve({error:"AI provider rate limit exceeded."})}}},p={parameters:{apiMocks:{...e,getTrendAISummary:()=>Promise.resolve({...h,headline:"Therapy needs attention",therapy_quality:"AHI has been creeping up and there are sustained large leaks.",flag:"alert",trend_direction:"worsening"})}}},d={parameters:{apiMocks:{...e,getTrendAISummary:()=>Promise.resolve({...h,headline:"Mixed results recently",therapy_quality:"Events are slightly elevated over the weekend.",flag:"watch",trend_direction:"variable"})}}};var _,v,M;t.parameters={...t.parameters,docs:{...(_=t.parameters)==null?void 0:_.docs,source:{originalSource:`{
  parameters: {
    apiMocks: defaultApiMocks
  }
}`,...(M=(v=t.parameters)==null?void 0:v.docs)==null?void 0:M.source}}};var k,y,S;s.parameters={...s.parameters,docs:{...(k=s.parameters)==null?void 0:k.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getSummary: () => new Promise(() => {}),
      // never resolves
      getOverviewStats: () => new Promise(() => {}) // never resolves
    }
  }
}`,...(S=(y=s.parameters)==null?void 0:y.docs)==null?void 0:S.source}}};var A,f,I;o.parameters={...o.parameters,docs:{...(A=o.parameters)==null?void 0:A.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getSummary: () => Promise.reject(new Error('Failed to load summary statistics from the server.'))
    }
  }
}`,...(I=(f=o.parameters)==null?void 0:f.docs)==null?void 0:I.source}}};var w,P,T;n.parameters={...n.parameters,docs:{...(w=n.parameters)==null?void 0:w.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getOverviewStats: () => Promise.resolve({
        nights: []
      })
    }
  }
}`,...(T=(P=n.parameters)==null?void 0:P.docs)==null?void 0:T.source}}};var b,E,x;i.parameters={...i.parameters,docs:{...(b=i.parameters)==null?void 0:b.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getImportSettings: () => Promise.resolve({
        ...mockImportSettings,
        llm_configured: false
      })
    }
  }
}`,...(x=(E=i.parameters)==null?void 0:E.docs)==null?void 0:x.source}}};var O,q,D;m.parameters={...m.parameters,docs:{...(O=m.parameters)==null?void 0:O.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => new Promise(() => {}) // never resolves
    }
  }
}`,...(D=(q=m.parameters)==null?void 0:q.docs)==null?void 0:D.source}}};var F,j,N;c.parameters={...c.parameters,docs:{...(F=c.parameters)==null?void 0:F.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({
        error: 'AI provider rate limit exceeded.'
      })
    }
  }
}`,...(N=(j=c.parameters)==null?void 0:j.docs)==null?void 0:N.source}}};var H,L,R;p.parameters={...p.parameters,docs:{...(H=p.parameters)==null?void 0:H.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({
        ...mockTrendAISummary,
        headline: 'Therapy needs attention',
        therapy_quality: 'AHI has been creeping up and there are sustained large leaks.',
        flag: 'alert',
        trend_direction: 'worsening'
      })
    }
  }
}`,...(R=(L=p.parameters)==null?void 0:L.docs)==null?void 0:R.source}}};var C,W,z;d.parameters={...d.parameters,docs:{...(C=d.parameters)==null?void 0:C.docs,source:{originalSource:`{
  parameters: {
    apiMocks: {
      ...defaultApiMocks,
      getTrendAISummary: () => Promise.resolve({
        ...mockTrendAISummary,
        headline: 'Mixed results recently',
        therapy_quality: 'Events are slightly elevated over the weekend.',
        flag: 'watch',
        trend_direction: 'variable'
      })
    }
  }
}`,...(z=(W=d.parameters)==null?void 0:W.docs)==null?void 0:z.source}}};const ge=["Default","Loading","ErrorState","EmptyNights","AINotConfigured","AILoading","AIError","AIFlagAlert","AIFlagWatch"];export{c as AIError,p as AIFlagAlert,d as AIFlagWatch,m as AILoading,i as AINotConfigured,t as Default,n as EmptyNights,o as ErrorState,s as Loading,ge as __namedExportsOrder,ue as default};
