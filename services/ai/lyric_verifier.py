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

【绝对强制的输出规则】
1. 你的回答【只能】是纯粹的歌词文本，或者 'NOT_FOUND'。
2. 绝对不允许包含任何解释、自我纠正、注释、"注意："、"以上是"等废话。
3. 绝对不允许输出作词、作曲、歌手、旁白等信息。
4. 必须输出正确的这首歌曲的原版歌词，不要受其他同名歌曲或同歌手的其他热门歌曲影响。
5. 如果你不确定，或者不知道这首歌，只能回复 'NOT_FOUND'。
6. 如果你找到了匹配的歌词，请直接开始输出第一句歌词，然后一行一句，直到结束。
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
        if result == "NOT_FOUND" or len(result) < 10:
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
        standard_lyrics = fetch_standard_lyrics(song_title)
        if standard_lyrics:
            print("[lyric_verifier] 成功使用知识库歌词替换转写歌词")
            
            # [临时 Debug] 将知识库歌词写入本地文件供对比
            try:
                debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug_deepseek_lyrics.txt")
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write("=== ORIGINAL (Whisper) ===\n")
                    f.write(raw_lyrics + "\n\n")
                    f.write("=== VERIFIED (DeepSeek Knowledge Base) ===\n")
                    f.write(standard_lyrics + "\n")
                print(f"[lyric_verifier] 临时DEBUG: 已将知识库歌词保存至 {debug_path}")
            except Exception as debug_e:
                print(f"[lyric_verifier] 保存debug文件失败: {debug_e}")

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
