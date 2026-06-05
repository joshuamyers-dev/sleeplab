import{S as P}from"./SessionDetail-DwIu2d99.js";import{c as e,M as C,R as H,d as Y}from"./iframe-CnI2o-UJ.js";import"./displayTz-CHfDPhD4.js";import"./WearableSleepStageChart-CmFKzQkZ.js";import"./card-N1AUAA9K.js";import"./utils-2dOUpm6k.js";import"./CartesianChart-CqEBiA-s.js";import"./index-CofT53Tl.js";import"./index-CeRDCxkJ.js";import"./LineChart-D6Am72TP.js";import"./Line-B0EOESsb.js";import"./ChevronIcons-BVlKKS3A.js";import"./EventInspector-CdXtG-DC.js";import"./button-C_rUzKqW.js";import"./ReferenceLine-DFyG7Qoo.js";import"./EventTimeline-D3NqbV1C.js";import"./InfoPopover-CNMkuGbS.js";import"./MetricsChartSplit-D29MjERO.js";import"./SpO2Chart-elT3AvG1.js";import"./SessionAICard-9imUkrdm.js";import"./GlossaryText-C8CDyE6b.js";import"./input-Cd2vQNG8.js";import"./label-CHU_Ngjj.js";import"./preload-helper-Dp1pzeXC.js";const a={id:"sesh-123",session_id:"sesh-123",folder_date:"2023-10-01",block_index:0,start_datetime:"2023-10-01T23:00:00Z",duration_seconds:28800,duration_hours:8,ahi:1.5,central_apnea_count:2,obstructive_apnea_count:5,hypopnea_count:5,apnea_count:7,arousal_count:0,total_ahi_events:12,avg_pressure:10.2,p95_pressure:12,avg_leak:.05,has_spo2:!0,machine_tz:"America/New_York",pld_start_datetime:"2023-10-01T23:00:00Z",device_serial:"12345678",avg_resp_rate:15.2,avg_tidal_vol:.5,avg_min_vent:7.5,avg_snore:.1,avg_flow_lim:.05,avg_spo2:95.5,min_spo2:89,therapy_mode:"AutoSet",mask_type:"Full Face",humidity_level:4,temperature_c:27},u=[{id:1,event_type:"Obstructive Apnea",onset_seconds:3600,duration_seconds:15,event_datetime:"2023-10-02T00:00:00Z"},{id:2,event_type:"Hypopnea",onset_seconds:7200,duration_seconds:12,event_datetime:"2023-10-02T01:00:00Z"}],d={timestamps:["2023-10-01T23:00:00Z","2023-10-02T07:00:00Z"],mask_pressure:[10,11],pressure:[10,11],epr_pressure:[8,9],leak:[0,.1],resp_rate:[15,14],tidal_vol:[.5,.55],min_vent:[7.5,7.7],snore:[0,0],flow_lim:[0,0]},j={timestamps:["2023-10-01T23:00:00Z","2023-10-02T07:00:00Z"],spo2:[96,95],pulse:[60,65]},J={cushion:{id:"eq-1",equipment_type:"cushion",start_date:"2023-09-01",replacement_days:30,mask_category:"F20",brand:"ResMed",model:"AirFit F20",notes:"",days_in_use:30,created_at:"",updated_at:""},headgear:null,tubing:null,humidifier_chamber:null,filter:null},K={hr:[{timestamp:"2023-10-01T23:00:00Z",value:60},{timestamp:"2023-10-02T07:00:00Z",value:65}],spo2:[{timestamp:"2023-10-01T23:00:00Z",value:96},{timestamp:"2023-10-02T07:00:00Z",value:95}],stages:[{timestamp:"2023-10-01T23:00:00Z",stage:1},{timestamp:"2023-10-02T07:00:00Z",stage:2}]},De={title:"Pages/SessionDetail",component:P,tags:["autodocs","ai-generated"],decorators:[(W,s)=>{const l=s.parameters.sessionData!==void 0?s.parameters.sessionData:a,B=s.parameters.wearableData!==void 0?s.parameters.wearableData:K,O=s.parameters.equipmentData!==void 0?s.parameters.equipmentData:J;return e.getSessionByDate=async()=>l,e.getEvents=async()=>u,e.getMetrics=async()=>d,e.getSessions=async()=>[l],e.getSessionSpo2=async()=>j,e.getInferredEquipment=async()=>O,e.getWearableData=async()=>B,e.getEventWindow=async()=>({event:u[0],neighboring_events:[],metrics:d,waveform:{timestamps:["2023-10-01T23:00:00Z"],flow:[.5],pressure:[10]}}),e.getSessionAISummary=async()=>({headline:"A good night's sleep",therapy_quality:"Great",high_confidence_observations:["Few events","Low leak"],possible_patterns:["Consistent breathing"],things_to_review:[],missing_or_uncertain:[],flag:"good",cached:!0}),e.getImportSettings=async()=>({llm_configured:!0}),s.parameters.loading&&(e.getSessionByDate=()=>new Promise(()=>{})),React.createElement(C,{initialEntries:["/sessions/2023-10-01"]},React.createElement(H,null,React.createElement(Y,{path:"/sessions/:date",element:React.createElement(W,null)})))}]},t={parameters:{loading:!0}},r={parameters:{sessionData:{...a,ahi:1.5}}},n={parameters:{sessionData:{...a,ahi:12}}},o={parameters:{sessionData:{...a,ahi:25}}},i={parameters:{sessionData:{...a,ahi:45}}},m={parameters:{sessionData:{...a,ahi:null}}},p={parameters:{sessionData:{...a,has_spo2:!1,therapy_mode:null,mask_type:null,humidity_level:null,temperature_c:null},wearableData:null,equipmentData:null}},c={parameters:{sessionData:{...a,machine_tz:null}}};var _,g,h;t.parameters={...t.parameters,docs:{...(_=t.parameters)==null?void 0:_.docs,source:{originalSource:`{
  parameters: {
    loading: true
  }
}`,...(h=(g=t.parameters)==null?void 0:g.docs)==null?void 0:h.source}}};var v,D,y;r.parameters={...r.parameters,docs:{...(v=r.parameters)==null?void 0:v.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 1.5
    }
  }
}`,...(y=(D=r.parameters)==null?void 0:D.docs)==null?void 0:y.source}}};var S,k,f;n.parameters={...n.parameters,docs:{...(S=n.parameters)==null?void 0:S.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 12.0
    }
  }
}`,...(f=(k=n.parameters)==null?void 0:k.docs)==null?void 0:f.source}}};var b,T,w;o.parameters={...o.parameters,docs:{...(b=o.parameters)==null?void 0:b.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 25.0
    }
  }
}`,...(w=(T=o.parameters)==null?void 0:T.docs)==null?void 0:w.source}}};var Z,N,E;i.parameters={...i.parameters,docs:{...(Z=i.parameters)==null?void 0:Z.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: 45.0
    }
  }
}`,...(E=(N=i.parameters)==null?void 0:N.docs)==null?void 0:E.source}}};var M,R,q;m.parameters={...m.parameters,docs:{...(M=m.parameters)==null?void 0:M.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      ahi: null
    }
  }
}`,...(q=(R=m.parameters)==null?void 0:R.docs)==null?void 0:q.source}}};var A,F,z;p.parameters={...p.parameters,docs:{...(A=p.parameters)==null?void 0:A.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      has_spo2: false,
      therapy_mode: null,
      mask_type: null,
      humidity_level: null,
      temperature_c: null
    },
    wearableData: null,
    equipmentData: null
  }
}`,...(z=(F=p.parameters)==null?void 0:F.docs)==null?void 0:z.source}}};var G,I,L;c.parameters={...c.parameters,docs:{...(G=c.parameters)==null?void 0:G.docs,source:{originalSource:`{
  parameters: {
    sessionData: {
      ...mockSession,
      machine_tz: null
    }
  }
}`,...(L=(I=c.parameters)==null?void 0:I.docs)==null?void 0:L.source}}};const ye=["Loading","GoodNight","MildNight","RoughNight","DifficultNight","NoDataNight","MinimalData","MissingTimezone"];export{i as DifficultNight,r as GoodNight,t as Loading,n as MildNight,p as MinimalData,c as MissingTimezone,m as NoDataNight,o as RoughNight,ye as __namedExportsOrder,De as default};
