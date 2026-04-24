import os
import json
import httpx
from typing import Optional, List, Dict

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
请根据文件名判断歌曲信息。待查询的文件名是：《{song_title}》。
以下是这首歌曲的【语音识别歌词片段】作为防伪参考：
"{transcript_snippet}"

请你在知识库中搜索这首特定歌曲的标准歌词。
注意：
1. 文件名可能只包含歌名（如“无悔这一生”），也可能包含歌手名（如“Beyond-无悔这一生”）。
2. 你必须验证你找到的歌词是否与上面的【语音识别歌词片段】能够匹配得上！
3. 绝对不要被歌手名误导而输出该歌手的其他热门歌曲（比如看到 Beyond 绝对不能输出光辉岁月或海阔天空）。如果发现匹配不上，请立刻回复 'NOT_FOUND'。
4. 如果你确信知道这首歌的歌词并且与音频片段吻合，请直接输出完整的原始歌词。
5. 不要包含任何解释、注音、歌手信息、作词作曲信息或多余的标点符号。
6. 请严格按照一行一句输出。
7. 如果你不确定或者不吻合，请严格且仅回复 'NOT_FOUND'。
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
7. 尽量保持字符总数相近，因为我们需要将其重新对齐到原始时间戳上。
8. 如果原文本正确，直接原样返回，不要过度修改。

【待校验歌词】
{lyrics}

【输出格式】
仅输出修正后的歌词文本，不要包含任何解释、标注或说明。
如有修改，仅输出最终结果。
"""

def fetch_standard_lyrics(song_title: str, transcript_snippet: str) -> Optional[str]:
    """尝试从 DeepSeek 知识库获取标准歌词"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key or not song_title:
        return None
        
    print(f"[lyric_verifier] 尝试向知识库查询: {song_title}")
    prompt = LYRIC_FETCH_PROMPT.format(song_title=song_title, transcript_snippet=transcript_snippet)
    
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,  # 降低温度，减少幻觉
        "max_tokens": 2048,
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            
        result = response.json()["choices"][0]["message"]["content"].strip()
        if result == "NOT_FOUND" or len(result) < 10:
            return None
            
        print(f"[lyric_verifier] 成功从知识库获取到《{song_title}》的标准歌词")
        return result
    except Exception as e:
        print(f"[lyric_verifier] fetch_standard_lyrics API failed: {e}")
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
        snippet = raw_lyrics[:150].replace("\n", " ")  # 取前150个字作为防伪参考
        standard_lyrics = fetch_standard_lyrics(song_title, snippet)
        if standard_lyrics:
            print("[lyric_verifier] 成功使用知识库歌词替换转写歌词")
            return {
                "verified_lyrics": standard_lyrics,
                "original_lyrics": raw_lyrics,
                "has_changes": True,
                "source": "knowledge_base"
            }

    print(f"[lyric_verifier] 知识库未命中，开始基于上下文纠错...")
    # 获取不到标准歌词，进行转写结果的纠错
    title_context = f"\n【歌曲信息】用户提供的音频文件名为《{song_title}》（这可能是歌手-歌名，也可能是其他格式，仅供你作为校对歌词时的上下文参考，请以原歌词为基础进行纠错，不要被歌手名误导）" if song_title else ""
    prompt = LYRIC_VERIFY_PROMPT.format(lyrics=raw_lyrics) + title_context

    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,  # 同样降低温度
        "max_tokens": 2048,
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            print(f"[lyric_verifier] 发送纠错请求到 DeepSeek...")
            response = client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            
        verified_lyrics = response.json()["choices"][0]["message"]["content"].strip()
        has_changes = verified_lyrics != raw_lyrics.strip()
        
        if has_changes:
            print(f"[lyric_verifier] 歌词已被修正")
            print(f"[lyric_verifier] 原文: {raw_lyrics[:50]}...")
            print(f"[lyric_verifier] 修正: {verified_lyrics[:50]}...")
        else:
            print(f"[lyric_verifier] DeepSeek 认为转写结果已完美，无需修正")
            
        return {
            "verified_lyrics": verified_lyrics,
            "original_lyrics": raw_lyrics,
            "has_changes": has_changes,
            "source": "correction"
        }
    except Exception as e:
        print(f"[lyric_verifier] verify_lyrics API failed: {e}，降级使用原始歌词")
        return {
            "verified_lyrics": raw_lyrics,
            "original_lyrics": raw_lyrics,
            "has_changes": False,
            "source": "fallback"
        }

def align_text_to_word_timestamps(verified_text: str, whisper_words: List[Dict]) -> List[Dict]:
    """
    将纠错后的纯文本重新映射回 Whisper 提供的字级时间戳。
    使用简单的比例映射或贪心匹配。
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
        
    # 如果 DeepSeek 修正后的歌词比原识别的少，我们按照比例压缩；
    # 如果多（补全了漏字），确保所有的字都塞进时间轴里，并且合理分配时间。
    aligned_words = []
    
    num_orig = len(original_tokens)
    num_new = len(verified_tokens)
    
    # 比例系数：新字流中的第 i 个 token，大约对应原字流中的第 i * ratio 个 token
    ratio = num_orig / max(1, num_new)
    
    for i, token in enumerate(verified_tokens):
        # 找到它在 original_tokens 中最接近的原始位置，使用平滑插值
        exact_orig_idx = i * ratio
        orig_idx = min(num_orig - 1, int(exact_orig_idx))
        
        ref_token = original_tokens[orig_idx]
        
        # 确保每个 token 都有独立的字典和时间
        start_time = ref_token["start"]
        end_time = ref_token["end"]
        
        aligned_words.append({
            "word": token,
            "start": start_time,
            "end": end_time
        })
        
    # 如果是对齐完成后产生的大长句，我们在 vocal_analysis.py 里由 _group_words_into_segments 处理
    return aligned_words
