import{B as E}from"./button-C_rUzKqW.js";import"./iframe-CnI2o-UJ.js";import"./preload-helper-Dp1pzeXC.js";import"./utils-2dOUpm6k.js";const{expect:L}=__STORYBOOK_MODULE_TEST__,U={title:"UI/Button",component:E,tags:["autodocs","ai-generated"]},a={args:{variant:"default",children:"Button"}},r={args:{variant:"secondary",children:"Button"}},e={args:{variant:"ghost",children:"Button"}},t={args:{variant:"outline",children:"Button"}},n={args:{size:"sm",children:"Button"}},s={args:{size:"lg",children:"Button"}},o={args:{children:"Submit",variant:"default"},play:async({canvas:x})=>{const D=x.getByRole("button",{name:/submit/i});await L(getComputedStyle(D).backgroundColor).toBe("rgb(82, 81, 167)")}};var c,i,u;a.parameters={...a.parameters,docs:{...(c=a.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    variant: 'default',
    children: 'Button'
  }
}`,...(u=(i=a.parameters)==null?void 0:i.docs)==null?void 0:u.source}}};var d,m,l;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    variant: 'secondary',
    children: 'Button'
  }
}`,...(l=(m=r.parameters)==null?void 0:m.docs)==null?void 0:l.source}}};var p,g,S;e.parameters={...e.parameters,docs:{...(p=e.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    variant: 'ghost',
    children: 'Button'
  }
}`,...(S=(g=e.parameters)==null?void 0:g.docs)==null?void 0:S.source}}};var h,B,b;t.parameters={...t.parameters,docs:{...(h=t.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    variant: 'outline',
    children: 'Button'
  }
}`,...(b=(B=t.parameters)==null?void 0:B.docs)==null?void 0:b.source}}};var v,y,f;n.parameters={...n.parameters,docs:{...(v=n.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    size: 'sm',
    children: 'Button'
  }
}`,...(f=(y=n.parameters)==null?void 0:y.docs)==null?void 0:f.source}}};var z,C,V;s.parameters={...s.parameters,docs:{...(z=s.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    children: 'Button'
  }
}`,...(V=(C=s.parameters)==null?void 0:C.docs)==null?void 0:V.source}}};var _,O,k;o.parameters={...o.parameters,docs:{...(_=o.parameters)==null?void 0:_.docs,source:{originalSource:`{
  args: {
    children: 'Submit',
    variant: 'default'
  },
  play: async ({
    canvas
  }) => {
    const button = canvas.getByRole('button', {
      name: /submit/i
    });
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(82, 81, 167)');
  }
}`,...(k=(O=o.parameters)==null?void 0:O.docs)==null?void 0:k.source}}};const I=["DefaultVariant","SecondaryVariant","GhostVariant","OutlineVariant","SmallSize","LargeSize","CssCheck"];export{o as CssCheck,a as DefaultVariant,e as GhostVariant,s as LargeSize,t as OutlineVariant,r as SecondaryVariant,n as SmallSize,I as __namedExportsOrder,U as default};
