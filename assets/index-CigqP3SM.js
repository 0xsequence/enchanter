const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BFpbhPzU.js","assets/index-BzJXWYc4.js","assets/index-CngNGh6y.css"])))=>i.map(i=>d[i]);
import{_ as fe}from"./index-BzJXWYc4.js";const me=Symbol(),ee=Object.getPrototypeOf,G=new WeakMap,he=e=>e&&(G.has(e)?G.get(e):ee(e)===Object.prototype||ee(e)===Array.prototype),ge=e=>he(e)&&e[me]||null,te=(e,t=!0)=>{G.set(e,t)};var z={BASE_URL:"/enchanter/",MODE:"production",DEV:!1,PROD:!0,SSR:!1};const q=e=>typeof e=="object"&&e!==null,A=new WeakMap,x=new WeakSet,be=(e=Object.is,t=(n,g)=>new Proxy(n,g),s=n=>q(n)&&!x.has(n)&&(Array.isArray(n)||!(Symbol.iterator in n))&&!(n instanceof WeakMap)&&!(n instanceof WeakSet)&&!(n instanceof Error)&&!(n instanceof Number)&&!(n instanceof Date)&&!(n instanceof String)&&!(n instanceof RegExp)&&!(n instanceof ArrayBuffer),r=n=>{switch(n.status){case"fulfilled":return n.value;case"rejected":throw n.reason;default:throw n}},l=new WeakMap,c=(n,g,I=r)=>{const y=l.get(n);if((y==null?void 0:y[0])===g)return y[1];const v=Array.isArray(n)?[]:Object.create(Object.getPrototypeOf(n));return te(v,!0),l.set(n,[g,v]),Reflect.ownKeys(n).forEach(P=>{if(Object.getOwnPropertyDescriptor(v,P))return;const E=Reflect.get(n,P),M={value:E,enumerable:!0,configurable:!0};if(x.has(E))te(E,!1);else if(E instanceof Promise)delete M.value,M.get=()=>I(E);else if(A.has(E)){const[b,H]=A.get(E);M.value=c(b,H(),I)}Object.defineProperty(v,P,M)}),Object.preventExtensions(v)},m=new WeakMap,f=[1,1],W=n=>{if(!q(n))throw new Error("object required");const g=m.get(n);if(g)return g;let I=f[0];const y=new Set,v=(i,a=++f[0])=>{I!==a&&(I=a,y.forEach(o=>o(i,a)))};let P=f[1];const E=(i=++f[1])=>(P!==i&&!y.size&&(P=i,b.forEach(([a])=>{const o=a[1](i);o>I&&(I=o)})),I),M=i=>(a,o)=>{const h=[...a];h[1]=[i,...h[1]],v(h,o)},b=new Map,H=(i,a)=>{if((z?"production":void 0)!=="production"&&b.has(i))throw new Error("prop listener already exists");if(y.size){const o=a[3](M(i));b.set(i,[a,o])}else b.set(i,[a])},Z=i=>{var a;const o=b.get(i);o&&(b.delete(i),(a=o[1])==null||a.call(o))},ue=i=>(y.add(i),y.size===1&&b.forEach(([o,h],_)=>{if((z?"production":void 0)!=="production"&&h)throw new Error("remove already exists");const R=o[3](M(_));b.set(_,[o,R])}),()=>{y.delete(i),y.size===0&&b.forEach(([o,h],_)=>{h&&(h(),b.set(_,[o]))})}),J=Array.isArray(n)?[]:Object.create(Object.getPrototypeOf(n)),$=t(J,{deleteProperty(i,a){const o=Reflect.get(i,a);Z(a);const h=Reflect.deleteProperty(i,a);return h&&v(["delete",[a],o]),h},set(i,a,o,h){const _=Reflect.has(i,a),R=Reflect.get(i,a,h);if(_&&(e(R,o)||m.has(o)&&e(R,m.get(o))))return!0;Z(a),q(o)&&(o=ge(o)||o);let V=o;if(o instanceof Promise)o.then(C=>{o.status="fulfilled",o.value=C,v(["resolve",[a],C])}).catch(C=>{o.status="rejected",o.reason=C,v(["reject",[a],C])});else{!A.has(o)&&s(o)&&(V=W(o));const C=!x.has(V)&&A.get(V);C&&H(a,C)}return Reflect.set(i,a,V,h),v(["set",[a],o,R]),!0}});m.set(n,$);const pe=[J,E,c,ue];return A.set($,pe),Reflect.ownKeys(n).forEach(i=>{const a=Object.getOwnPropertyDescriptor(n,i);"value"in a&&($[i]=n[i],delete a.value,delete a.writable),Object.defineProperty(J,i,a)}),$})=>[W,A,x,e,t,s,r,l,c,m,f],[ye]=be();function j(e={}){return ye(e)}function S(e,t,s){const r=A.get(e);(z?"production":void 0)!=="production"&&!r&&console.warn("Please use proxy object");let l;const c=[],m=r[3];let f=!1;const n=m(g=>{c.push(g),l||(l=Promise.resolve().then(()=>{l=void 0,f&&t(c.splice(0))}))});return f=!0,()=>{f=!1,n()}}function ve(e,t){const s=A.get(e);(z?"production":void 0)!=="production"&&!s&&console.warn("Please use proxy object");const[r,l,c]=s;return c(r,l(),t)}const d=j({history:["ConnectWallet"],view:"ConnectWallet",data:void 0}),de={state:d,subscribe(e){return S(d,()=>e(d))},push(e,t){e!==d.view&&(d.view=e,t&&(d.data=t),d.history.push(e))},reset(e){d.view=e,d.history=[e]},replace(e){d.history.length>1&&(d.history[d.history.length-1]=e,d.view=e)},goBack(){if(d.history.length>1){d.history.pop();const[e]=d.history.slice(-1);d.view=e}},setData(e){d.data=e}},p={WALLETCONNECT_DEEPLINK_CHOICE:"WALLETCONNECT_DEEPLINK_CHOICE",WCM_VERSION:"WCM_VERSION",RECOMMENDED_WALLET_AMOUNT:9,isMobile(){return typeof window<"u"?!!(window.matchMedia("(pointer:coarse)").matches||/Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini/u.test(navigator.userAgent)):!1},isAndroid(){return p.isMobile()&&navigator.userAgent.toLowerCase().includes("android")},isIos(){const e=navigator.userAgent.toLowerCase();return p.isMobile()&&(e.includes("iphone")||e.includes("ipad"))},isHttpUrl(e){return e.startsWith("http://")||e.startsWith("https://")},isArray(e){return Array.isArray(e)&&e.length>0},formatNativeUrl(e,t,s){if(p.isHttpUrl(e))return this.formatUniversalUrl(e,t,s);let r=e;r.includes("://")||(r=e.replaceAll("/","").replaceAll(":",""),r=`${r}://`),r.endsWith("/")||(r=`${r}/`),this.setWalletConnectDeepLink(r,s);const l=encodeURIComponent(t);return`${r}wc?uri=${l}`},formatUniversalUrl(e,t,s){if(!p.isHttpUrl(e))return this.formatNativeUrl(e,t,s);let r=e;r.endsWith("/")||(r=`${r}/`),this.setWalletConnectDeepLink(r,s);const l=encodeURIComponent(t);return`${r}wc?uri=${l}`},async wait(e){return new Promise(t=>{setTimeout(t,e)})},openHref(e,t){window.open(e,t,"noreferrer noopener")},setWalletConnectDeepLink(e,t){try{localStorage.setItem(p.WALLETCONNECT_DEEPLINK_CHOICE,JSON.stringify({href:e,name:t}))}catch{console.info("Unable to set WalletConnect deep link")}},setWalletConnectAndroidDeepLink(e){try{const[t]=e.split("?");localStorage.setItem(p.WALLETCONNECT_DEEPLINK_CHOICE,JSON.stringify({href:t,name:"Android"}))}catch{console.info("Unable to set WalletConnect android deep link")}},removeWalletConnectDeepLink(){try{localStorage.removeItem(p.WALLETCONNECT_DEEPLINK_CHOICE)}catch{console.info("Unable to remove WalletConnect deep link")}},setModalVersionInStorage(){try{typeof localStorage<"u"&&localStorage.setItem(p.WCM_VERSION,"2.6.2")}catch{console.info("Unable to set Web3Modal version in storage")}},getWalletRouterData(){var e;const t=(e=de.state.data)==null?void 0:e.Wallet;if(!t)throw new Error('Missing "Wallet" view data');return t}},we=typeof location<"u"&&(location.hostname.includes("localhost")||location.protocol.includes("https")),u=j({enabled:we,userSessionId:"",events:[],connectedWalletId:void 0}),Ie={state:u,subscribe(e){return S(u.events,()=>e(ve(u.events[u.events.length-1])))},initialize(){u.enabled&&typeof(crypto==null?void 0:crypto.randomUUID)<"u"&&(u.userSessionId=crypto.randomUUID())},setConnectedWalletId(e){u.connectedWalletId=e},click(e){if(u.enabled){const t={type:"CLICK",name:e.name,userSessionId:u.userSessionId,timestamp:Date.now(),data:e};u.events.push(t)}},track(e){if(u.enabled){const t={type:"TRACK",name:e.name,userSessionId:u.userSessionId,timestamp:Date.now(),data:e};u.events.push(t)}},view(e){if(u.enabled){const t={type:"VIEW",name:e.name,userSessionId:u.userSessionId,timestamp:Date.now(),data:e};u.events.push(t)}}},L=j({chains:void 0,walletConnectUri:void 0,isAuth:!1,isCustomDesktop:!1,isCustomMobile:!1,isDataLoaded:!1,isUiLoaded:!1}),w={state:L,subscribe(e){return S(L,()=>e(L))},setChains(e){L.chains=e},setWalletConnectUri(e){L.walletConnectUri=e},setIsCustomDesktop(e){L.isCustomDesktop=e},setIsCustomMobile(e){L.isCustomMobile=e},setIsDataLoaded(e){L.isDataLoaded=e},setIsUiLoaded(e){L.isUiLoaded=e},setIsAuth(e){L.isAuth=e}},B=j({projectId:"",mobileWallets:void 0,desktopWallets:void 0,walletImages:void 0,chains:void 0,enableAuthMode:!1,enableExplorer:!0,explorerExcludedWalletIds:void 0,explorerRecommendedWalletIds:void 0,termsOfServiceUrl:void 0,privacyPolicyUrl:void 0}),N={state:B,subscribe(e){return S(B,()=>e(B))},setConfig(e){var t,s;Ie.initialize(),w.setChains(e.chains),w.setIsAuth(!!e.enableAuthMode),w.setIsCustomMobile(!!((t=e.mobileWallets)!=null&&t.length)),w.setIsCustomDesktop(!!((s=e.desktopWallets)!=null&&s.length)),p.setModalVersionInStorage(),Object.assign(B,e)}};var Le=Object.defineProperty,se=Object.getOwnPropertySymbols,Oe=Object.prototype.hasOwnProperty,Ee=Object.prototype.propertyIsEnumerable,ne=(e,t,s)=>t in e?Le(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s,We=(e,t)=>{for(var s in t||(t={}))Oe.call(t,s)&&ne(e,s,t[s]);if(se)for(var s of se(t))Ee.call(t,s)&&ne(e,s,t[s]);return e};const Q="https://explorer-api.walletconnect.com",X="wcm",Y="js-2.6.2";async function K(e,t){const s=We({sdkType:X,sdkVersion:Y},t),r=new URL(e,Q);return r.searchParams.append("projectId",N.state.projectId),Object.entries(s).forEach(([l,c])=>{c&&r.searchParams.append(l,String(c))}),(await fetch(r)).json()}const U={async getDesktopListings(e){return K("/w3m/v1/getDesktopListings",e)},async getMobileListings(e){return K("/w3m/v1/getMobileListings",e)},async getInjectedListings(e){return K("/w3m/v1/getInjectedListings",e)},async getAllListings(e){return K("/w3m/v1/getAllListings",e)},getWalletImageUrl(e){return`${Q}/w3m/v1/getWalletImage/${e}?projectId=${N.state.projectId}&sdkType=${X}&sdkVersion=${Y}`},getAssetImageUrl(e){return`${Q}/w3m/v1/getAssetImage/${e}?projectId=${N.state.projectId}&sdkType=${X}&sdkVersion=${Y}`}};var Ce=Object.defineProperty,oe=Object.getOwnPropertySymbols,Ae=Object.prototype.hasOwnProperty,je=Object.prototype.propertyIsEnumerable,re=(e,t,s)=>t in e?Ce(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s,Me=(e,t)=>{for(var s in t||(t={}))Ae.call(t,s)&&re(e,s,t[s]);if(oe)for(var s of oe(t))je.call(t,s)&&re(e,s,t[s]);return e};const ae=p.isMobile(),O=j({wallets:{listings:[],total:0,page:1},search:{listings:[],total:0,page:1},recomendedWallets:[]}),Te={state:O,async getRecomendedWallets(){const{explorerRecommendedWalletIds:e,explorerExcludedWalletIds:t}=N.state;if(e==="NONE"||t==="ALL"&&!e)return O.recomendedWallets;if(p.isArray(e)){const s={recommendedIds:e.join(",")},{listings:r}=await U.getAllListings(s),l=Object.values(r);l.sort((c,m)=>{const f=e.indexOf(c.id),W=e.indexOf(m.id);return f-W}),O.recomendedWallets=l}else{const{chains:s,isAuth:r}=w.state,l=s==null?void 0:s.join(","),c=p.isArray(t),m={page:1,sdks:r?"auth_v1":void 0,entries:p.RECOMMENDED_WALLET_AMOUNT,chains:l,version:2,excludedIds:c?t.join(","):void 0},{listings:f}=ae?await U.getMobileListings(m):await U.getDesktopListings(m);O.recomendedWallets=Object.values(f)}return O.recomendedWallets},async getWallets(e){const t=Me({},e),{explorerRecommendedWalletIds:s,explorerExcludedWalletIds:r}=N.state,{recomendedWallets:l}=O;if(r==="ALL")return O.wallets;l.length?t.excludedIds=l.map(I=>I.id).join(","):p.isArray(s)&&(t.excludedIds=s.join(",")),p.isArray(r)&&(t.excludedIds=[t.excludedIds,r].filter(Boolean).join(",")),w.state.isAuth&&(t.sdks="auth_v1");const{page:c,search:m}=e,{listings:f,total:W}=ae?await U.getMobileListings(t):await U.getDesktopListings(t),n=Object.values(f),g=m?"search":"wallets";return O[g]={listings:[...O[g].listings,...n],total:W,page:c??1},{listings:n,total:W}},getWalletImageUrl(e){return U.getWalletImageUrl(e)},getAssetImageUrl(e){return U.getAssetImageUrl(e)},resetSearch(){O.search={listings:[],total:0,page:1}}},k=j({open:!1}),F={state:k,subscribe(e){return S(k,()=>e(k))},async open(e){return new Promise(t=>{const{isUiLoaded:s,isDataLoaded:r}=w.state;if(p.removeWalletConnectDeepLink(),w.setWalletConnectUri(e==null?void 0:e.uri),w.setChains(e==null?void 0:e.chains),de.reset("ConnectWallet"),s&&r)k.open=!0,t();else{const l=setInterval(()=>{const c=w.state;c.isUiLoaded&&c.isDataLoaded&&(clearInterval(l),k.open=!0,t())},200)}})},close(){k.open=!1}};var Ue=Object.defineProperty,ie=Object.getOwnPropertySymbols,De=Object.prototype.hasOwnProperty,Se=Object.prototype.propertyIsEnumerable,le=(e,t,s)=>t in e?Ue(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s,Pe=(e,t)=>{for(var s in t||(t={}))De.call(t,s)&&le(e,s,t[s]);if(ie)for(var s of ie(t))Se.call(t,s)&&le(e,s,t[s]);return e};function _e(){return typeof matchMedia<"u"&&matchMedia("(prefers-color-scheme: dark)").matches}const T=j({themeMode:_e()?"dark":"light"}),ce={state:T,subscribe(e){return S(T,()=>e(T))},setThemeConfig(e){const{themeMode:t,themeVariables:s}=e;t&&(T.themeMode=t),s&&(T.themeVariables=Pe({},s))}},D=j({open:!1,message:"",variant:"success"}),$e={state:D,subscribe(e){return S(D,()=>e(D))},openToast(e,t){D.open=!0,D.message=e,D.variant=t},closeToast(){D.open=!1}};class ke{constructor(t){this.openModal=F.open,this.closeModal=F.close,this.subscribeModal=F.subscribe,this.setTheme=ce.setThemeConfig,ce.setThemeConfig(t),N.setConfig(t),this.initUi()}async initUi(){if(typeof window<"u"){await fe(()=>import("./index-BFpbhPzU.js"),__vite__mapDeps([0,1,2]));const t=document.createElement("wcm-modal");document.body.insertAdjacentElement("beforeend",t),w.setIsUiLoaded(!0)}}}const Ve=Object.freeze(Object.defineProperty({__proto__:null,WalletConnectModal:ke},Symbol.toStringTag,{value:"Module"}));export{Ie as R,de as T,p as a,Ve as i,ce as n,$e as o,w as p,F as s,Te as t,N as y};
