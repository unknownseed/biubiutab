import re

with open("services/ai/main.py", "r", encoding="utf-8") as f:
    content = f.read()

upload_logic = """        # If using R2, upload all generated artifacts back to cloud
        if job.storage_provider == "r2":
            job.message = "正在将伴奏和吉他谱送上云端..."
            await _save_job_state(job)
            
            def _upload_all_r2():
                # Upload stems
                if stems_dir.exists():
                    for f in stems_dir.iterdir():
                        if f.is_file():
                            r2_key = f"stems/{job.id}/{f.name}"
                            _upload_r2_artifact(f, r2_key, "audio/wav")
                # Upload results
                if results_dir.exists():
                    for f in results_dir.iterdir():
                        if f.is_file():
                            r2_key = f"results/{job.id}/{f.name}"
                            ctype = "application/json" if f.suffix == ".json" else "application/octet-stream"
                            if f.suffix == ".lrc" or f.suffix == ".alphatex":
                                ctype = "text/plain"
                            _upload_r2_artifact(f, r2_key, ctype)
                            
            await asyncio.to_thread(_upload_all_r2)

"""

# Insert before job.status = "succeeded"
content = content.replace('        job.status = "succeeded"', upload_logic + '        job.status = "succeeded"')

with open("services/ai/main.py", "w", encoding="utf-8") as f:
    f.write(content)

