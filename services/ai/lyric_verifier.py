import os
import json
import httpx
from typing import Optional, List, Dict
from openai import OpenAI

try:
    from dotenv import load_dotenv
    # Explicitly load from services/ai/.env
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

# 1. 尝试直接从知识库获取标准歌词
LYRIC_FETCH_PROMPT = """你是一个强大的音乐知识库。
你的任务是根据我提供的文件名，输出这首特定歌曲的【标准原版歌词】。

待查询的文件名：《{song_title}》

【工作步骤】
1. 内部检索：请先在你的知识库中回忆这首歌的演唱者、所属专辑和发行年份，把这些信息写出来作为你的回忆线索（这能帮你避免同名歌曲的混淆）。
2. 准确度判断：如果你对这首歌的印象模糊，或者这是一首不在你训练数据里的冷门歌曲/AI生成的歌曲，绝对不允许瞎编！请直接在最后回复 'NOT_FOUND'。
3. 输出标准歌词：如果你确信记得完整且准确的原版歌词，请将【纯净的歌词文本】包裹在 <lyrics> 和 </lyrics> 标签内。

【歌词格式要求】
- <lyrics> 标签内的歌词必须是一行一句。
- <lyrics> 标签内绝对不允许包含作词、作曲、编曲、歌手、旁白等元数据信息。
- 千万不要在一句话里陷入无限死循环的重复。
"""

# 2. 歌词纠错 Prompt
LYRIC_VERIFY_PROMPT = """你是一位专业的歌词校对编辑，精通普通话、粤语、闽南语等中文方言歌词。
你的任务是对语音识别系统转写的歌词进行校验与修正。

【校验规则】
1. 修正明显的同音字、近音字错误（如"在哪里"误识别为"载哪里"）
2. 修正粤语特有字词错误（如"系"不应改为"是"，"佢"不应改为"他"）
3. 补全因背景音乐干扰导致的漏字（仅在有高度把握时补全）
4. 过滤非歌词内容（如语气词"嗯"、"啊"等不必要的重复，但保留歌词中原有的语气词）
5. 保持原有的分行结构，不要合并或拆分歌词行
6. 不要更改歌词的语言（粤语歌词保持粤语，不要翻译成普通话）
7. 你可以大幅度修改错词，甚至修改错乱的句子，但尽量保持总体字符数相近，因为我们需要将其重新对齐到原始时间戳上。
8. 如果原文本正确，直接原样返回，不要过度修改。

【待校验歌词】
{lyrics}

【输出格式】
仅输出修正后的歌词文本，不要包含任何解释、标注或说明。
如有修改，仅输出最终结果。
"""

def fetch_lyrics_from_lrclib(song_title: str) -> Optional[str]:
    """尝试从 LRCLIB 获取准确的非幻觉歌词"""
    print(f"[lyric_verifier] 尝试向 LRCLIB 搜索: {song_title}")
    
    url = "https://lrclib.net/api/search"
    # 清理文件名，提取可能有用的搜索词
    # 如果文件名包含扩展名，去掉扩展名
    import re
    clean_title = re.sub(r'\.[a-zA-Z0-9]+$', '', song_title)
    
    params = {"q": clean_title}
    # LRCLIB 官方要求携带清晰的 User-Agent
    headers = {"User-Agent": "BiubiuTab/1.0 (Integration)"} 
    
    try:
        with httpx.Client() as client:
            response = client.get(url, params=params, headers=headers, timeout=10.0)
            if response.status_code == 200:
                results = response.json()
                if results and len(results) > 0:
                    # 获取第一条结果的纯文本歌词
                    lyrics = results[0].get("plainLyrics")
                    if lyrics:
                        print(f"[lyric_verifier] 成功从 LRCLIB 获取到《{song_title}》的歌词！")
                        return lyrics
            else:
                print(f"[lyric_verifier] LRCLIB 返回异常状态码: {response.status_code}")
    except Exception as e:
        print(f"[lyric_verifier] LRCLIB 请求失败: {e}")
        
    return None

def fetch_lyrics_from_kugou(song_title: str) -> Optional[str]:
    """尝试从 酷狗音乐 获取准确的歌词 (对中文/粤语老歌覆盖率极高)"""
    print(f"[lyric_verifier] 尝试向 Kugou 搜索: {song_title}")
    
    import re
    clean_title = re.sub(r'\.[a-zA-Z0-9]+$', '', song_title)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    try:
        with httpx.Client() as client:
            # 1. 搜索获取 filehash
            search_url = "http://mobilecdn.kugou.com/api/v3/search/song"
            params = {"keyword": clean_title, "page": 1, "pagesize": 1}
            res = client.get(search_url, params=params, headers=headers, timeout=10.0).json()
            songs = res.get("data", {}).get("info", [])
            
            if not songs:
                print(f"[lyric_verifier] Kugou 未找到《{song_title}》")
                return None
                
            filehash = songs[0]["hash"]
            
            # 2. 获取歌词
            lrc_url = "http://m.kugou.com/app/i/krc.php"
            lrc_params = {"cmd": 100, "hash": filehash, "timelength": 999999}
            lrc_res = client.get(lrc_url, params=lrc_params, headers=headers, timeout=10.0)
            
            if lrc_res.status_code == 200:
                lrc_text = lrc_res.text
                if not lrc_text:
                    return None
                    
                # 清理时间轴和元数据
                plain_text = re.sub(r'\[.*?\]', '', lrc_text)
                lines = [line.strip() for line in plain_text.split('\n') if line.strip()]
                
                # 过滤掉开头的作词、作曲信息，只保留纯歌词
                cleaned_lines = []
                for line in lines:
                    if any(prefix in line for prefix in ["作词：", "作曲：", "演唱：", "编曲："]):
                        continue
                    cleaned_lines.append(line)
                    
                final_lyrics = '\n'.join(cleaned_lines)
                if final_lyrics:
                    print(f"[lyric_verifier] 成功从 Kugou 获取到《{song_title}》的歌词！")
                    return final_lyrics
    except Exception as e:
        print(f"[lyric_verifier] Kugou 请求失败: {e}")
        
    return None

def fetch_standard_lyrics(song_title: str) -> Optional[str]:
    """尝试从 DeepSeek 知识库获取标准歌词"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    # 允许通过环境变量配置模型名称，如果没有配置，则使用你提到的 deepseek-v4-flash
    model_name = os.environ.get("DEEPSEEK_MODEL_NAME", "deepseek-v4-flash")
    
    if not api_key or not song_title:
        return None
        
    print(f"[lyric_verifier] 尝试向知识库查询: {song_title} (使用模型: {model_name})")
    prompt = LYRIC_FETCH_PROMPT.format(song_title=song_title)
    
    try:
        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            stream=False,
            temperature=0.0
        )
        
        result = response.choices[0].message.content.strip()
        
        # 提取 <lyrics> 标签内的纯净歌词
        import re
        match = re.search(r'<lyrics>(.*?)</lyrics>', result, re.DOTALL)
        if match:
            result = match.group(1).strip()
        else:
            # 如果没有标签，且返回内容包含 NOT_FOUND，视为未找到
            if "NOT_FOUND" in result or len(result) < 10:
                return None
            
        # [防幻觉死循环机制]
        # 检查是否因为温度为0且强行编造，导致模型陷入疯狂重复同一句话的死循环（如重复50次“在无尽风中”）
        lines = [line.strip() for line in result.split('\n') if line.strip()]
        if len(lines) > 5:
            unique_lines = len(set(lines))
            # 如果独立行数占总行数的比例不到 20%，说明模型疯了，直接回退为 NOT_FOUND
            if unique_lines / len(lines) < 0.2:
                print(f"[lyric_verifier] 警告：检测到知识库发生死循环复读幻觉（总行数{len(lines)}，去重仅{unique_lines}），强制回退")
                return None
            
        print(f"[lyric_verifier] 成功从知识库获取到《{song_title}》的标准歌词")
        return result
    except Exception as e:
        print(f"[lyric_verifier] fetch_standard_lyrics OpenAI SDK failed: {e}")
        return None

def verify_lyrics(raw_lyrics: str, song_title: Optional[str] = None) -> dict:
    """使用 DeepSeek API 校验和修正歌词"""
    # Dynamic check in case env was loaded late
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("[lyric_verifier] DEEPSEEK_API_KEY 未设置，跳过校验")
        return {"verified_lyrics": raw_lyrics, "has_changes": False}

    print(f"[lyric_verifier] 开始处理歌曲: {song_title}")
    
    # 如果有歌名，先尝试直接获取标准歌词
    if song_title:
        standard_lyrics = None
        source_name = "unknown"
        
        # 1. 首选：从免费、高精度且绝对无幻觉的公开 API (LRCLIB) 获取歌词
        standard_lyrics = fetch_lyrics_from_lrclib(song_title)
        if standard_lyrics:
            source_name = "lrclib"
        
        # 2. 次选：对于 LRCLIB 没有覆盖的中文/粤语老歌，尝试酷狗音乐 API
        if not standard_lyrics:
            print("[lyric_verifier] LRCLIB 未命中，降级使用 Kugou API...")
            standard_lyrics = fetch_lyrics_from_kugou(song_title)
            if standard_lyrics:
                source_name = "kugou"
        
        # 3. 兜底：如果 API 全军覆没，再让 DeepSeek 凭记忆尝试回忆
        if not standard_lyrics:
            print("[lyric_verifier] API 均未命中，降级使用 DeepSeek 知识库...")
            standard_lyrics = fetch_standard_lyrics(song_title)
            if standard_lyrics:
                source_name = "deepseek_knowledge_base"
            
        if standard_lyrics:
            print(f"[lyric_verifier] 成功使用外部标准歌词替换转写歌词 (来源: {source_name})")
            
            # [临时 Debug] 将知识库歌词写入本地文件供对比
            try:
                debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug_deepseek_lyrics.txt")
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write("=== ORIGINAL (Whisper) ===\n")
                    f.write(raw_lyrics + "\n\n")
                    f.write(f"=== VERIFIED ({source_name.upper()}) ===\n")
                    f.write(standard_lyrics + "\n")
                print(f"[lyric_verifier] 临时DEBUG: 已将标准歌词保存至 {debug_path}")
            except Exception as debug_e:
                print(f"[lyric_verifier] 保存debug文件失败: {debug_e}")

            return {
                "verified_lyrics": standard_lyrics,
                "original_lyrics": raw_lyrics,
                "has_changes": True,
                "source": source_name
            }

    print(f"[lyric_verifier] 知识库未命中，开始基于上下文纠错...")
    # 获取不到标准歌词，进行转写结果的纠错
    title_context = f"\n【歌曲信息】用户提供的音频文件名为《{song_title}》（这可能是歌手-歌名，也可能是其他格式，仅供你作为校对歌词时的上下文参考，请以原歌词为基础进行纠错，不要被歌手名误导）" if song_title else ""
    prompt = LYRIC_VERIFY_PROMPT.format(lyrics=raw_lyrics) + title_context
    
    # 获取环境变量中的模型名称
    model_name = os.environ.get("DEEPSEEK_MODEL_NAME", "deepseek-v4-flash")

    try:
        print(f"[lyric_verifier] 发送纠错请求到 DeepSeek (使用模型: {model_name})...")
        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            stream=False,
            temperature=0.0
        )
            
        verified_lyrics = response.choices[0].message.content.strip()
        has_changes = verified_lyrics != raw_lyrics.strip()
        
        if has_changes:
            print(f"[lyric_verifier] 歌词已被修正")
            print(f"[lyric_verifier] 原文: {raw_lyrics[:50]}...")
            print(f"[lyric_verifier] 修正: {verified_lyrics[:50]}...")
        else:
            print(f"[lyric_verifier] DeepSeek 认为转写结果已完美，无需修正")
            
        # [临时 Debug] 将修正后的纯文本写入本地文件供对比
        try:
            debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug_deepseek_lyrics.txt")
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write("=== ORIGINAL (Whisper) ===\n")
                f.write(raw_lyrics + "\n\n")
                f.write("=== VERIFIED (DeepSeek) ===\n")
                f.write(verified_lyrics + "\n")
            print(f"[lyric_verifier] 临时DEBUG: 已将DeepSeek返回的纯文本歌词保存至 {debug_path}")
        except Exception as debug_e:
            print(f"[lyric_verifier] 保存debug文件失败: {debug_e}")
            
        return {
            "verified_lyrics": verified_lyrics,
            "original_lyrics": raw_lyrics,
            "has_changes": has_changes,
            "source": "correction"
        }
    except Exception as e:
        print(f"[lyric_verifier] verify_lyrics OpenAI SDK failed: {e}，降级使用原始歌词")
        return {
            "verified_lyrics": raw_lyrics,
            "original_lyrics": raw_lyrics,
            "has_changes": False,
            "source": "fallback"
        }

def align_text_to_word_timestamps(verified_text: str, whisper_words: List[Dict]) -> List[Dict]:
    """
    将纠错后的纯文本重新映射回 Whisper 提供的字级时间戳。
    使用基于动态规划的 Levenshtein (编辑距离) 序列比对算法，替代原有的线性比例映射。
    这样可以完美处理错别字修改、漏字补全和多字删除，保证时间戳严丝合缝。
    """
    if not whisper_words or not verified_text:
        return whisper_words
        
    import re
    # 分词：匹配英文单词、数字、或者单个中文字符/标点，忽略纯空格
    verified_tokens = re.findall(r'[a-zA-Z0-9\']+|[^\s]', verified_text)
    
    if not verified_tokens:
        return whisper_words
        
    # 对 Whisper 提取的词也进行同样的细粒度分词，并平分该词的时间
    original_tokens = []
    for w in whisper_words:
        word_text = w.get("word", "").strip()
        tokens = re.findall(r'[a-zA-Z0-9\']+|[^\s]', word_text)
        if not tokens:
            continue
            
        duration = w["end"] - w["start"]
        step = duration / len(tokens)
        for i, t in enumerate(tokens):
            original_tokens.append({
                "token": t,
                "start": w["start"] + i * step,
                "end": w["start"] + (i + 1) * step
            })
            
    if not original_tokens:
        return whisper_words
        
    n = len(verified_tokens)
    m = len(original_tokens)
    
    # ==== 核心：Levenshtein 动态规划对齐 ====
    # dp[i][j] 表示 verified_tokens[:i] 与 original_tokens[:j] 的最小编辑距离
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
        
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            # 判断字符是否完全一致（可以加入拼音相似度，但这里直接字符匹配已经足够好）
            cost = 0 if verified_tokens[i-1] == original_tokens[j-1]['token'] else 1
            dp[i][j] = min(
                dp[i-1][j] + 1,      # 插入 (DeepSeek 新增了 Whisper 没听到的字)
                dp[i][j-1] + 1,      # 删除 (Whisper 听出了幻觉多余的字，DeepSeek 把它删了)
                dp[i-1][j-1] + cost  # 匹配 / 替换 (Whisper 听错了字，DeepSeek 把它改对了)
            )
            
    # ==== 回溯寻找最佳对齐路径 ====
    i, j = n, m
    # verified_to_orig 记录每个 verified_token 对应到了哪个 original_token 的索引
    verified_to_orig = [-1] * n
    
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if verified_tokens[i-1] == original_tokens[j-1]['token'] else 1
            if dp[i][j] == dp[i-1][j-1] + cost:
                # 匹配或替换
                verified_to_orig[i-1] = j - 1
                i -= 1
                j -= 1
                continue
                
        if i > 0 and (j == 0 or dp[i][j] == dp[i-1][j] + 1):
            # 插入：DeepSeek 新增了字。我们把它“依附”在当前 j 指向的原始时间戳上
            verified_to_orig[i-1] = min(max(0, j), m - 1)
            i -= 1
        else:
            # 删除：Whisper 的冗余字被丢弃，直接跳过 j
            j -= 1

    # ==== 构造最终带时间戳的字级列表 ====
    aligned_words = []
    
    for idx, token in enumerate(verified_tokens):
        orig_idx = verified_to_orig[idx]
        ref_token = original_tokens[orig_idx]
        
        aligned_words.append({
            "word": token,
            "start": ref_token["start"],
            "end": ref_token["end"]
        })
        
    return aligned_words
