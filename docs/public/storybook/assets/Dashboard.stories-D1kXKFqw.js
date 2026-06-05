import{D as v}from"./Dashboard-DRpyHBCL.js";import{c as e,M as P}from"./iframe-CnI2o-UJ.js";import"./AISummaryCard-C7yRgMUY.js";import"./aiSummaryCache-BSuJUHZx.js";import"./GlossaryText-C8CDyE6b.js";import"./index-CofT53Tl.js";import"./index-CeRDCxkJ.js";import"./button-C_rUzKqW.js";import"./utils-2dOUpm6k.js";import"./card-N1AUAA9K.js";import"./CalendarHeatmap-DmkoIIuT.js";import"./AHITrendChart-wsAb9T9r.js";import"./CartesianChart-CqEBiA-s.js";import"./LineChart-D6Am72TP.js";import"./ReferenceLine-DFyG7Qoo.js";import"./Line-B0EOESsb.js";import"./WearableSleepSummaryChart-D5SWF6un.js";import"./Legend-Dmw4eLJW.js";import"./Bar-DZympaB4.js";import"./ChevronIcons-BVlKKS3A.js";import"./InfoPopover-CNMkuGbS.js";import"./preload-helper-Dp1pzeXC.js";const y={total_nights:30,nights_with_data:28,compliance_pct:93.3,avg_ahi:2.4,avg_pressure:10.2,ahi_trend:[{folder_date:"2023-10-01",ahi:3.1,duration_hours:7.5,session_id:"1"},{folder_date:"2023-10-02",ahi:2.2,duration_hours:8,session_id:"2"},{folder_date:"2023-10-03",ahi:1.8,duration_hours:6.5,session_id:"3"},{folder_date:"2023-10-04",ahi:2.5,duration_hours:7.2,session_id:"4"},{folder_date:"2023-10-05",ahi:1.5,duration_hours:6.8,session_id:"5"}],event_breakdown:{obstructive_apnea:15,central_apnea:2,hypopnea:20}},k=[{id:"1",session_id:"1",folder_date:"2023-10-01",block_index:0,start_datetime:"2023-10-01T22:00:00Z",duration_seconds:27e3,duration_hours:7.5,ahi:3.1,central_apnea_count:0,obstructive_apnea_count:5,hypopnea_count:10,apnea_count:5,arousal_count:0,total_ahi_events:15,avg_pressure:10,p95_pressure:11,avg_leak:2,has_spo2:!1,machine_tz:"UTC"},{id:"2",session_id:"2",folder_date:"2023-10-02",block_index:0,start_datetime:"2023-10-02T22:30:00Z",duration_seconds:28800,duration_hours:8,ahi:2.2,central_apnea_count:1,obstructive_apnea_count:3,hypopnea_count:8,apnea_count:4,arousal_count:2,total_ahi_events:14,avg_pressure:10.5,p95_pressure:11.5,avg_leak:1.5,has_spo2:!0,machine_tz:"UTC"}],w=[{date:"2023-10-01",avg_hr:60,avg_spo2:96,awake_h:.5,light_h:4,deep_h:1.5,rem_h:1.5},{date:"2023-10-02",avg_hr:58,avg_spo2:97,awake_h:.3,light_h:4.2,deep_h:1.8,rem_h:1.7}],b={llm_configured:!0},E={headline:"Therapy is looking great.",therapy_quality:"Your treatment is well managed with a very low number of events.",high_confidence_observations:["Good overall compliance","AHI remains below 5"],possible_patterns:["Slightly higher events on weekends"],things_to_review:["Mask seal might be slipping on some nights"],missing_or_uncertain:[],cached:!0},J={title:"Pages/Dashboard",component:v,tags:["autodocs","ai-generated"],decorators:[r=>React.createElement(P,null,React.createElement(r,null))]},o={decorators:[r=>(e.getSummary=()=>new Promise(()=>{}),e.getSessions=()=>new Promise(()=>{}),React.createElement(r,null))]},t={name:"Error",decorators:[r=>(e.getSummary=()=>Promise.reject(new Error("Failed to connect to API")),e.getSessions=()=>Promise.reject(new Error("Failed to connect to API")),React.createElement(r,null))]},a={decorators:[r=>(e.getSummary=()=>Promise.resolve({total_nights:0,nights_with_data:0,compliance_pct:0,avg_ahi:null,avg_pressure:null,ahi_trend:[],event_breakdown:{}}),e.getSessions=()=>Promise.resolve([]),React.createElement(r,null))]},s={decorators:[r=>(e.getSummary=()=>Promise.resolve(y),e.getSessions=()=>Promise.resolve(k),e.getWearableSummary=()=>Promise.resolve(w),e.getImportSettings=()=>Promise.resolve(b),e.getAISummary=()=>Promise.resolve(E),React.createElement(r,null))]};var n,i,m;o.parameters={...o.parameters,docs:{...(n=o.parameters)==null?void 0:n.docs,source:{originalSource:`{
  decorators: [Story => {
    // Mock APIs to never resolve to simulate loading state
    api.getSummary = () => new Promise(() => {});
    api.getSessions = () => new Promise(() => {});
    return <Story />;
  }]
}`,...(m=(i=o.parameters)==null?void 0:i.docs)==null?void 0:m.source}}};var c,l,p;t.parameters={...t.parameters,docs:{...(c=t.parameters)==null?void 0:c.docs,source:{originalSource:`{
  name: 'Error',
  decorators: [Story => {
    // Mock APIs to reject to simulate error state
    api.getSummary = () => Promise.reject(new Error('Failed to connect to API'));
    api.getSessions = () => Promise.reject(new Error('Failed to connect to API'));
    return <Story />;
  }]
}`,...(p=(l=t.parameters)==null?void 0:l.docs)==null?void 0:p.source}}};var u,_,d;a.parameters={...a.parameters,docs:{...(u=a.parameters)==null?void 0:u.docs,source:{originalSource:`{
  decorators: [Story => {
    // Mock APIs to return empty data
    api.getSummary = () => Promise.resolve({
      total_nights: 0,
      nights_with_data: 0,
      compliance_pct: 0,
      avg_ahi: null,
      avg_pressure: null,
      ahi_trend: [],
      event_breakdown: {}
    });
    api.getSessions = () => Promise.resolve([]);
    return <Story />;
  }]
}`,...(d=(_=a.parameters)==null?void 0:_.docs)==null?void 0:d.source}}};var g,h,S;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
  decorators: [Story => {
    // Mock APIs to return full data
    api.getSummary = () => Promise.resolve(mockSummaryPopulated);
    api.getSessions = () => Promise.resolve(mockSessionsPopulated);
    api.getWearableSummary = () => Promise.resolve(mockWearableSummaryPopulated);
    api.getImportSettings = () => Promise.resolve(mockImportSettings);
    api.getAISummary = () => Promise.resolve(mockAISummary);
    return <Story />;
  }]
}`,...(S=(h=s.parameters)==null?void 0:h.docs)==null?void 0:S.source}}};const K=["Loading","ErrorState","Empty","Populated"];export{a as Empty,t as ErrorState,o as Loading,s as Populated,K as __namedExportsOrder,J as default};
