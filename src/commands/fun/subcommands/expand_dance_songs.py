#!/usr/bin/env python3
"""Build a US-focused, recent-upload YouTube catalog using the official Data API."""
import argparse, collections, getpass, html, json, os, re, sys, unicodedata
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parent

def norm(s):
    s=unicodedata.normalize('NFKD',html.unescape(s)).lower()
    s=''.join(c for c in s if not unicodedata.combining(c))
    s=re.sub(r'\([^)]*(?:official|lyrics?|visualiz|music video|audio|remaster|hd|4k)[^)]*\)|\[[^]]*(?:official|lyrics?|visualiz|music video|audio|remaster|hd|4k)[^]]*\]','',s)
    s=re.sub(r'\b(?:official music video|official video|official audio|lyric video|visualizer|lyrics|provided to youtube by)\b','',s)
    return re.sub(r'[^a-z0-9]+','',s)

def songkeys(row):
    title=row['title']; channel=row['channel']; parts=re.split(r'\s+[-–—]\s+',title,maxsplit=1)
    artist=re.sub(r'(?i)(vevo|\s*-\s*topic|official artist channel)$','',channel).strip()
    if len(parts)==2: return {norm(title),norm(parts[0])+':'+norm(parts[1]),norm(artist)+':'+norm(parts[1])}
    return {norm(artist)+':'+norm(title)}

def seconds(s):
    m=re.fullmatch(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?',s)
    if not m:return 0
    h,mn,sec=(int(x or 0) for x in m.groups());return h*3600+mn*60+sec

def save(path,data):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');tmp.replace(path)

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT/'dance-songs.json');p.add_argument('--output',type=Path,default=ROOT/'dance-songs-expanded.json');p.add_argument('--target',type=int,default=2000);p.add_argument('--max-searches',type=int,default=95);p.add_argument('--after',default='2025-01-01');p.add_argument('--seeds',type=Path,default=ROOT/'genre-seeds.txt');p.add_argument('--reset',action='store_true');a=p.parse_args()
    original=json.loads(a.input.read_text(encoding='utf-8')); baseids={r['videoId'] for v in original.values() for r in v}
    statepath=a.output.with_suffix('.progress.json'); state={'done':[],'pools':{}}
    if statepath.exists() and not a.reset:state=json.loads(statepath.read_text(encoding='utf-8'))
    groups={line.split('|',1)[0]:line.split('|',1)[1].split(';') for line in a.seeds.read_text(encoding='utf-8').splitlines() if line.strip()}
    key=os.environ.get('YOUTUBE_API_KEY') or getpass.getpass('YouTube Data API key: ')
    def api(endpoint,**params):
        try:
            with urlopen('https://www.googleapis.com/youtube/v3/'+endpoint+'?'+urlencode(dict(params,key=key)),timeout=30) as r:return json.load(r)
        except HTTPError as e:
            try: reason=json.load(e)['error']['errors'][0]['reason']
            except Exception:reason=str(e.code)
            raise RuntimeError(f'YouTube API error: {reason}') from None
    def export():
        result={k:list(v) for k,v in original.items()}; seen=set(baseids); keys=set().union(*(songkeys(r) for v in original.values() for r in v)); channels=collections.Counter(); count=0
        pools={g:iter(state['pools'].get(g,[])) for g in groups}; active=list(groups)
        while active and count<a.target:
            for g in active[:]:
                if count>=a.target:break
                for row in pools[g]:
                    k=songkeys(row); ch=norm(row['channel'])
                    if row['videoId'] in seen or keys.intersection(k) or channels[ch]>=14:continue
                    result.setdefault(g,[]).append(row); seen.add(row['videoId']);keys.update(k);channels[ch]+=1;count+=1;break
                else:active.remove(g)
        save(a.output,result);save(a.output.with_name(a.output.stem+'-new-only.json'),{g:[r for r in v if r['videoId'] not in baseids] for g,v in result.items() if any(r['videoId'] not in baseids for r in v)})
        return count
    calls=0
    # First pass covers every scene; subsequent passes use separate artist groups.
    jobs=[]
    for g,artists in groups.items():jobs.append((g,g+' music', 'scene'))
    for start in (0,3):
        for g,artists in groups.items():
            jobs.append((g,' | '.join('"'+x+'"' for x in artists[start:start+3]),f'artists{start}'))
    for g,artists in groups.items():
        for artist in artists:jobs.append((g,artist+' official music',artist))
    try:
        for g,q,tag in jobs:
            job=g+'::'+tag
            if job in state['done']:continue
            if calls>=a.max_searches:break
            if export()>=a.target and all(x+'::scene' in state['done'] for x in groups):break
            calls+=1
            raw=api('search',part='snippet',type='video',q=q,maxResults=50,regionCode='US',videoCategoryId='10',videoEmbeddable='true',publishedAfter=a.after+'T00:00:00Z',order='relevance')
            ids=[x['id']['videoId'] for x in raw.get('items',[]) if 'videoId' in x.get('id',{})]
            videos=api('videos',part='snippet,contentDetails,status',id=','.join(ids)).get('items',[]) if ids else []
            pool=state['pools'].setdefault(g,[])
            for v in videos:
                s=v['snippet']; d=v['contentDetails']; status=v['status']; title=html.unescape(s['title']); channel=html.unescape(s['channelTitle']);
                if not status.get('embeddable') or status.get('privacyStatus')!='public' or s.get('liveBroadcastContent')!='none':continue
                if not 90<=seconds(d.get('duration',''))<=720:continue
                if 'US' in d.get('regionRestriction',{}).get('blocked',[]):continue
                if 'allowed' in d.get('regionRestriction',{}) and 'US' not in d['regionRestriction']['allowed']:continue
                if re.search(r'(?i)\b(full album|playlist|reaction|tutorial|type beat|hour mix|dj set|live stream|compilation|karaoke|ai cover|sped up|slowed and reverb|remastered|remaster|tribute|fan made)\b',title):continue
                if re.search(r'(?i)\b(reaction|type beats|karaoke)\b',channel):continue
                # Require a music-like title/channel or a match to a curated artist.
                combined=norm(channel+' '+title)
                artist_match=any(len(norm(x))>=3 and norm(x) in combined for x in groups[g])
                official=bool(re.search(r'(?i)official|music video|lyric|visualizer|audio| - topic$',title+' '+channel))
                if not (artist_match or official):continue
                pool.append({'videoId':v['id'],'channel':channel,'title':title,'videoYear':int(s['publishedAt'][:4])})
            state['done'].append(job);save(statepath,state);n=export();print(f'{n}/{a.target} new | {g} | {tag}',flush=True)
    except (RuntimeError,OSError,KeyboardInterrupt) as e:print(f'Stopped: {e}. Progress saved; rerun to resume.',file=sys.stderr)
    n=export();print(f'Final: {n} new; {len(baseids)} original unique video IDs. Output: {a.output}')
    if n<a.target:print('Target not reached. Rerun to continue remaining queries; quota resets daily.')

if __name__=='__main__':main()
