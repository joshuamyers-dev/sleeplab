import{M as c,A as d}from"./iframe-CnI2o-UJ.js";import{L as l}from"./Login-BDUcKq7y.js";import"./preload-helper-Dp1pzeXC.js";import"./button-C_rUzKqW.js";import"./utils-2dOUpm6k.js";import"./card-N1AUAA9K.js";import"./input-Cd2vQNG8.js";import"./label-CHU_Ngjj.js";const A={title:"Pages/Login",component:l,tags:["autodocs","ai-generated"],decorators:[e=>(window.localStorage.removeItem("cpap_auth_token"),React.createElement(c,null,React.createElement(d,null,React.createElement(e,null))))]},r={decorators:[e=>(window.__APP_CONFIG__&&(window.__APP_CONFIG__.DISABLE_USER_REGISTRATION=!1),React.createElement(e,null))]},t={decorators:[e=>(window.__APP_CONFIG__={...window.__APP_CONFIG__,DISABLE_USER_REGISTRATION:!0},React.createElement(e,null))]};var o,a,n;r.parameters={...r.parameters,docs:{...(o=r.parameters)==null?void 0:o.docs,source:{originalSource:`{
  decorators: [Story => {
    // Ensure registration is enabled for the default story
    if (window.__APP_CONFIG__) {
      window.__APP_CONFIG__.DISABLE_USER_REGISTRATION = false;
    }
    return <Story />;
  }]
}`,...(n=(a=r.parameters)==null?void 0:a.docs)==null?void 0:n.source}}};var _,s,i;t.parameters={...t.parameters,docs:{...(_=t.parameters)==null?void 0:_.docs,source:{originalSource:`{
  decorators: [Story => {
    // Override config to disable registration for this story
    window.__APP_CONFIG__ = {
      ...window.__APP_CONFIG__,
      DISABLE_USER_REGISTRATION: true
    };
    return <Story />;
  }]
}`,...(i=(s=t.parameters)==null?void 0:s.docs)==null?void 0:i.source}}};const P=["Default","RegistrationDisabled"];export{r as Default,t as RegistrationDisabled,P as __namedExportsOrder,A as default};
