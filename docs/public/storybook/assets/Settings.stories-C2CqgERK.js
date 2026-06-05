import{c as e,U as P,M as U,A as D,R as N,d as p,k as c}from"./iframe-CnI2o-UJ.js";import{S as I}from"./Settings-gMwsPfRu.js";import"./preload-helper-Dp1pzeXC.js";import"./button-C_rUzKqW.js";import"./utils-2dOUpm6k.js";import"./card-N1AUAA9K.js";import"./input-Cd2vQNG8.js";import"./label-CHU_Ngjj.js";import"./displayTz-CHfDPhD4.js";const u={user_id:"1",email:"test@example.com",first_name:"Test",last_name:"User"},n={sleephq_enabled:!0,sleephq_client_id:"client_12345",has_client_secret:!0,sleephq_client_secret:null,sleephq_team_id:100,sleephq_machine_id:200,auto_import_sleephq:!1,lookback_days:30,local_datalog_path:"/data/DATALOG",local_import_frequency:"daily",last_local_import_at:"2023-10-12T08:00:00Z",last_local_import_status:"ok - 1 session imported",wearable_provider:"open-wearables",wearable_base_url:"https://wearables.example.com",wearable_api_key:null,machine_tz:"America/New_York",display_tz:"America/New_York",has_machine_tz:!0,has_display_tz:!0,llm_provider:"ollama",llm_base_url:"http://localhost:11434",llm_model:"llama3.1:8b",has_llm_api_key:!0,llm_api_key:null,llm_configured:!0},Z={title:"Pages/SettingsPage",component:I,tags:["autodocs","ai-generated"],decorators:[(v,T)=>{const{mockAuth:m=!0,mockSettings:i=n,rejectSettings:x=!1}=T.parameters;return c.get=()=>m?"fake-token":null,c.set=()=>{},c.clear=()=>{},e.me=async()=>{if(!m)throw new P;return u},e.getImportSettings=async()=>{if(x)throw new Error("Not found");return i},e.updateProfile=async l=>({...u,...l}),e.changePassword=async()=>({status:"ok"}),e.saveImportSettings=async l=>({...i,...l}),e.triggerSleepHQImport=async()=>({status:"ok",message:"Import started successfully."}),e.deleteAllSessions=async()=>{},React.createElement(U,{initialEntries:["/settings"]},React.createElement(D,null,React.createElement("div",{className:"p-4 bg-[var(--background)] min-h-screen"},React.createElement(N,null,React.createElement(p,{path:"/settings",element:React.createElement(v,null)}),React.createElement(p,{path:"/login",element:React.createElement("div",{className:"p-4 text-[var(--danger-text)] text-center font-bold"},"Redirected to /login")})))))}]},t={parameters:{mockAuth:!0,mockSettings:n}},a={parameters:{mockAuth:!0,rejectSettings:!0}},r={parameters:{mockAuth:!0,mockSettings:{...n,sleephq_enabled:!1}}},s={parameters:{mockAuth:!0,mockSettings:{...n,has_machine_tz:!1,has_display_tz:!1}}},o={parameters:{mockAuth:!1}};var d,_,h;t.parameters={...t.parameters,docs:{...(d=t.parameters)==null?void 0:d.docs,source:{originalSource:`{
  parameters: {
    mockAuth: true,
    mockSettings: defaultSettings
  }
}`,...(h=(_=t.parameters)==null?void 0:_.docs)==null?void 0:h.source}}};var g,k,S;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  parameters: {
    mockAuth: true,
    rejectSettings: true
  }
}`,...(S=(k=a.parameters)==null?void 0:k.docs)==null?void 0:S.source}}};var f,y,A;r.parameters={...r.parameters,docs:{...(f=r.parameters)==null?void 0:f.docs,source:{originalSource:`{
  parameters: {
    mockAuth: true,
    mockSettings: {
      ...defaultSettings,
      sleephq_enabled: false
    }
  }
}`,...(A=(y=r.parameters)==null?void 0:y.docs)==null?void 0:A.source}}};var b,R,w;s.parameters={...s.parameters,docs:{...(b=s.parameters)==null?void 0:b.docs,source:{originalSource:`{
  parameters: {
    mockAuth: true,
    mockSettings: {
      ...defaultSettings,
      has_machine_tz: false,
      has_display_tz: false
    }
  }
}`,...(w=(R=s.parameters)==null?void 0:R.docs)==null?void 0:w.source}}};var E,z,q;o.parameters={...o.parameters,docs:{...(E=o.parameters)==null?void 0:E.docs,source:{originalSource:`{
  parameters: {
    mockAuth: false
  }
}`,...(q=(z=o.parameters)==null?void 0:z.docs)==null?void 0:q.source}}};const B=["Default","FirstTimeSetup","SleepHQDisabled","MissingTimezone","Unauthenticated"];export{t as Default,a as FirstTimeSetup,s as MissingTimezone,r as SleepHQDisabled,o as Unauthenticated,B as __namedExportsOrder,Z as default};
