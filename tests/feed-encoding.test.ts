import assert from "node:assert/strict";
import test from "node:test";
import {decodeFeedBytes} from "../app/lib/feed-encoding.ts";
import {parseFeed} from "../app/lib/rss.ts";
const source={domain:"folha.uol.com.br",country:"Brazil",language:"Português",url:"https://feeds.folha.uol.com.br/emcimadahora/rss091.xml"};
const latin=(text:string)=>Uint8Array.from([...text].map(char=>char.charCodeAt(0)));
test("Folha ISO-8859-1 raw bytes preserve accented titles and XML entities",()=>{
 const title="São Paulo: último El Niño, máxima de 29°C, 2º turno";
 const xml=`<?xml version="1.0" encoding="ISO-8859-1"?><rss><item><title>${title} &amp; chuva</title><link>https://redir.folha.com.br/a</link></item></rss>`;
 const bytes=latin(xml);
 assert.match(new TextDecoder().decode(bytes),/�/);
 const decoded=decodeFeedBytes(bytes,"text/xml");
 assert.doesNotMatch(decoded,/�/);
 assert.equal(parseFeed(decoded,source)[0].title,`${title} & chuva`);
});
test("UTF-8 and Japanese remain unchanged",()=>{
 const xml='<?xml version="1.0" encoding="UTF-8"?><rss><title>日本のニュース · São Paulo</title></rss>';
 assert.equal(decodeFeedBytes(new TextEncoder().encode(xml),"application/rss+xml"),xml);
});
test("HTTP charset and its quoted alias are respected",()=>{
 assert.equal(decodeFeedBytes(latin('São Paulo'), 'text/xml; charset="latin1"'),'São Paulo');
});
test("BOM wins and UTF-16 LE/BE decode correctly",()=>{
 const text='<rss>日本</rss>';
 const utf8=new Uint8Array([0xef,0xbb,0xbf,...new TextEncoder().encode(text)]);
 assert.equal(decodeFeedBytes(utf8,'text/xml; charset=iso-8859-1'),text);
 const le=new Uint8Array([0xff,0xfe,...[...text].flatMap(x=>[x.charCodeAt(0)&255,x.charCodeAt(0)>>8])]);
 const be=new Uint8Array([0xfe,0xff,...[...text].flatMap(x=>[x.charCodeAt(0)>>8,x.charCodeAt(0)&255])]);
 assert.equal(decodeFeedBytes(le),text);assert.equal(decodeFeedBytes(be),text);
});
test("unknown encoding and invalid UTF-8 fail instead of storing replacements",()=>{
 assert.throws(()=>decodeFeedBytes(latin('São'), 'text/xml; charset=unknown-encoding'));
 assert.throws(()=>decodeFeedBytes(latin('São')));
});
