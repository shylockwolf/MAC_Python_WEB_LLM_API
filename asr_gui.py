import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import os
import sys
import threading
import subprocess
import tempfile
from pathlib import Path

# 添加python-clients到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-clients'))

from riva.client import ASRService, Auth

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

# 加载环境变量
try:
    from dotenv import load_dotenv
    load_dotenv()
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

class ASRGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("NVIDIA Whisper ASR")
        self.root.geometry("900x600")
        self.root.resizable(True, True)
        
        # API配置 - 从环境变量读取，如果没有则使用默认值
        self.api_key = os.getenv('NVIDIA_API_KEY')
        self.server = os.getenv('NVIDIA_SERVER', 'grpc.nvcf.nvidia.com:443')
        self.function_id = os.getenv('NVIDIA_FUNCTION_ID', 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d')
        
        # 变量
        self.audio_file_path = ""
        self.temp_wav_path = None  # 用于存储临时WAV文件路径
        self.whisper_model = None  # Whisper模型实例
        self.current_whisper_model_size = None  # 当前加载的Whisper模型大小
        
        # 创建界面
        self.create_widgets()
    
    def create_widgets(self):
        # 顶部框架 - 文件选择
        top_frame = tk.Frame(self.root, padx=20, pady=20)
        top_frame.pack(fill=tk.X)
        
        tk.Label(top_frame, text="语音文件:", font=("Arial", 12)).grid(row=0, column=0, padx=10, pady=5, sticky=tk.W)
        
        self.file_path_var = tk.StringVar()
        self.file_path_entry = tk.Entry(top_frame, textvariable=self.file_path_var, width=50)
        self.file_path_entry.grid(row=0, column=1, padx=10, pady=5, sticky=tk.W)
        
        self.browse_btn = tk.Button(top_frame, text="浏览", command=self.browse_file, width=10)
        self.browse_btn.grid(row=0, column=2, padx=10, pady=5, sticky=tk.W)
        
        # 模型选择
        tk.Label(top_frame, text="模型:", font=("Arial", 12)).grid(row=1, column=0, padx=10, pady=5, sticky=tk.W)
        
        self.model_var = tk.StringVar(value="api")
        model_options = [
            ("NVIDIA API", "api"),
            ("本地 Whisper", "local")
        ]
        
        if not WHISPER_AVAILABLE:
            model_options = [("NVIDIA API", "api")]
        
        self.model_menu = tk.OptionMenu(top_frame, self.model_var, *[opt[1] for opt in model_options])
        self.model_menu.config(width=15)
        self.model_menu.grid(row=1, column=1, padx=10, pady=5, sticky=tk.W)
        
        # Whisper模型大小选择（仅在选择本地模型时显示）
        tk.Label(top_frame, text="模型大小:", font=("Arial", 12)).grid(row=2, column=0, padx=10, pady=5, sticky=tk.W)
        
        self.whisper_size_var = tk.StringVar(value="base")
        whisper_sizes = [
            ("Tiny (最快)", "tiny"),
            ("Base", "base"),
            ("Small", "small"),
            ("Medium", "medium"),
            ("Large (最准确)", "large")
        ]
        
        self.whisper_size_menu = tk.OptionMenu(top_frame, self.whisper_size_var, *[opt[1] for opt in whisper_sizes])
        self.whisper_size_menu.config(width=15)
        self.whisper_size_menu.grid(row=2, column=1, padx=10, pady=5, sticky=tk.W)
        
        # 语言选择
        tk.Label(top_frame, text="语言:", font=("Arial", 12)).grid(row=3, column=0, padx=10, pady=5, sticky=tk.W)
        
        self.language_var = tk.StringVar(value="multi")
        language_options = [
            ("自动检测", "multi"),
            ("中文", "zh-CN"),
            ("英文", "en-US"),
            ("日语", "ja-JP"),
            ("韩语", "ko-KR"),
            ("法语", "fr-FR"),
            ("德语", "de-DE"),
            ("西班牙语", "es-ES"),
            ("意大利语", "it-IT"),
            ("葡萄牙语", "pt-BR"),
            ("俄语", "ru-RU")
        ]
        
        self.language_menu = tk.OptionMenu(top_frame, self.language_var, *[opt[1] for opt in language_options])
        self.language_menu.config(width=15)
        self.language_menu.grid(row=3, column=1, padx=10, pady=5, sticky=tk.W)
        
        self.process_btn = tk.Button(top_frame, text="处理", command=self.process_audio, width=10, bg="#4CAF50", fg="black")
        self.process_btn.grid(row=3, column=2, padx=10, pady=5, sticky=tk.W)
        
        # 中间框架 - 结果显示
        middle_frame = tk.Frame(self.root, padx=20, pady=20)
        middle_frame.pack(fill=tk.BOTH, expand=True)
        
        # 结果显示标签
        tk.Label(middle_frame, text="转录结果:", font=("Arial", 12)).pack(anchor=tk.W, padx=10, pady=10)
        
        # 结果文本框
        self.result_text = scrolledtext.ScrolledText(middle_frame, width=90, height=15, font=("Arial", 11))
        self.result_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 调试信息标签
        tk.Label(middle_frame, text="调试信息:", font=("Arial", 12)).pack(anchor=tk.W, padx=10, pady=10)
        
        # 调试信息文本框
        self.debug_text = scrolledtext.ScrolledText(middle_frame, width=90, height=10, font=("Arial", 10), fg="gray")
        self.debug_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 底部框架 - 状态
        bottom_frame = tk.Frame(self.root, padx=20, pady=20)
        bottom_frame.pack(fill=tk.X)
        
        self.status_var = tk.StringVar()
        self.status_var.set("就绪")
        
        self.status_label = tk.Label(bottom_frame, textvariable=self.status_var, font=("Arial", 10), fg="blue")
        self.status_label.pack(anchor=tk.W)
    
    def browse_file(self):
        file_path = filedialog.askopenfilename(
            title="选择语音文件",
            filetypes=[
                ("音频文件", "*.wav *.opus *.flac *.m4a *.mp3"),
                ("所有文件", "*.*")
            ]
        )
        if file_path:
            self.audio_file_path = file_path
            self.file_path_var.set(file_path)
            self.status_var.set(f"已选择文件: {os.path.basename(file_path)}")
    
    def process_audio(self):
        if not self.audio_file_path:
            messagebox.showerror("错误", "请先选择语音文件")
            return
        
        # 禁用按钮，防止重复点击
        self.process_btn.config(state=tk.DISABLED)
        self.browse_btn.config(state=tk.DISABLED)
        self.status_var.set("正在处理...")
        
        # 在新线程中处理，避免阻塞UI
        threading.Thread(target=self._process_audio_thread).start()
    
    def _process_audio_thread(self):
        try:
            # 清理临时文件
            if self.temp_wav_path and os.path.exists(self.temp_wav_path):
                try:
                    os.remove(self.temp_wav_path)
                    debug_msg = f"清理临时文件: {self.temp_wav_path}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                except Exception as e:
                    debug_msg = f"清理临时文件失败: {str(e)}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                self.temp_wav_path = None
            
            # 清空调试信息
            self.root.after(0, self._clear_debug)
            
            # 添加调试信息
            debug_msg = f"开始处理文件: {self.audio_file_path}\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 检查选择的模型类型
            model_type = self.model_var.get()
            debug_msg = f"选择的模型类型: {model_type}\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            if model_type == "local":
                # 使用本地Whisper模型
                self._process_with_whisper()
            else:
                # 使用NVIDIA API
                self._process_with_nvidia_api()
                
        except Exception as e:
            error_msg = f"处理失败: {str(e)}"
            self.root.after(0, self._add_debug, error_msg + "\n")
            self.root.after(0, self._show_error, error_msg)
        finally:
            # 恢复按钮状态
            self.root.after(0, self._restore_buttons)
            
            # 清理临时WAV文件
            if self.temp_wav_path and os.path.exists(self.temp_wav_path):
                try:
                    os.remove(self.temp_wav_path)
                    debug_msg = f"清理临时WAV文件: {self.temp_wav_path}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    self.temp_wav_path = None
                except Exception as e:
                    debug_msg = f"清理临时WAV文件失败: {str(e)}\n"
                    self.root.after(0, self._add_debug, debug_msg)
    
    def _process_with_whisper(self):
        """使用本地Whisper模型处理音频"""
        if not WHISPER_AVAILABLE:
            raise Exception("Whisper库未安装，请先安装: pip install openai-whisper")
        
        # 临时禁用SSL验证以解决证书问题
        import ssl
        original_ssl_context = ssl._create_default_https_context
        
        try:
            # 创建不验证证书的SSL上下文
            ssl._create_default_https_context = ssl._create_unverified_context
            
            # 检查文件格式，如果不支持则转换
            file_ext = os.path.splitext(self.audio_file_path)[1].lower()
            supported_formats = ['.wav', '.mp3', '.ogg', '.flac', '.m4a']
            
            if file_ext not in supported_formats:
                debug_msg = f"文件格式 {file_ext} 不被支持，需要转换为WAV格式\n"
                self.root.after(0, self._add_debug, debug_msg)
                
                # 使用ffmpeg转换为WAV格式
                try:
                    temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                    self.temp_wav_path = temp_wav.name
                    temp_wav.close()
                    
                    debug_msg = f"使用ffmpeg转换音频到WAV格式: {self.temp_wav_path}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    
                    # 使用ffmpeg转换音频
                    result = subprocess.run(
                        ['ffmpeg', '-i', self.audio_file_path, '-ar', '16000', '-ac', '1', '-y', self.temp_wav_path],
                        capture_output=True,
                        text=True,
                        timeout=300  # 5分钟超时
                    )
                    
                    if result.returncode != 0:
                        debug_msg = f"ffmpeg转换失败: {result.stderr}\n"
                        self.root.after(0, self._add_debug, debug_msg)
                        raise Exception(f"音频转换失败: {result.stderr}")
                    
                    debug_msg = "音频转换成功\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    
                    # 使用转换后的WAV文件
                    audio_file = self.temp_wav_path
                except FileNotFoundError:
                    debug_msg = "ffmpeg未安装，尝试使用原始文件\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    audio_file = self.audio_file_path
                except subprocess.TimeoutExpired:
                    debug_msg = "音频转换超时\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    raise Exception("音频转换超时")
                except Exception as e:
                    debug_msg = f"音频转换出错: {str(e)}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    raise
            else:
                audio_file = self.audio_file_path
            
            # 加载Whisper模型
            model_size = self.whisper_size_var.get()
            debug_msg = f"加载Whisper模型: {model_size}\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 如果模型未加载或模型大小不同，则重新加载
            if self.whisper_model is None or self.current_whisper_model_size != model_size:
                try:
                    self.whisper_model = whisper.load_model(model_size)
                    self.current_whisper_model_size = model_size
                    debug_msg = f"Whisper模型加载成功\n"
                    self.root.after(0, self._add_debug, debug_msg)
                except Exception as e:
                    debug_msg = f"Whisper模型加载失败: {str(e)}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    raise
            
            # 转录音频
            debug_msg = "开始转录音频...\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 根据语言选择设置语言参数
            selected_language = self.language_var.get()
            language = None
            if selected_language != "multi":
                # 将语言代码转换为Whisper格式
                lang_map = {
                    "zh-CN": "zh",
                    "en-US": "en",
                    "ja-JP": "ja",
                    "ko-KR": "ko",
                    "fr-FR": "fr",
                    "de-DE": "de",
                    "es-ES": "es",
                    "it-IT": "it",
                    "pt-BR": "pt",
                    "ru-RU": "ru"
                }
                language = lang_map.get(selected_language)
                if language:
                    debug_msg = f"设置语言: {language}\n"
                    self.root.after(0, self._add_debug, debug_msg)
            
            # 使用Whisper进行转录
            result = self.whisper_model.transcribe(
                audio_file,
                language=language,
                task="transcribe",
                fp16=False  # 使用FP32以提高兼容性
            )
            
            debug_msg = "Whisper转录完成\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 处理转录结果
            final_text = result["text"].strip()
            
            # 按句子分割
            import re
            sentences = []
            for sentence in re.split(r'([.!?。！？，；；、]+)', final_text):
                sentence = sentence.strip()
                if sentence:
                    # 如果是标点符号，添加到前一个句子
                    if re.match(r'^[.!?。！？，；；、]+$', sentence):
                        if sentences:
                            sentences[-1] += sentence
                    else:
                        sentences.append(sentence)
            
            # 确保每个句子都有标点符号
            final_sentences = []
            for sentence in sentences:
                if not re.search(r'[.!?。！？，；；、]$', sentence):
                    sentence += '。'
                final_sentences.append(sentence)
            
            final_text = "\n".join(final_sentences)
            
            debug_msg = f"最终转录文本: {final_text}\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 更新UI
            self.root.after(0, self._update_result, final_text)
                
        except Exception as e:
            debug_msg = f"Whisper处理失败: {str(e)}\n"
            self.root.after(0, self._add_debug, debug_msg)
            raise
        finally:
            # 恢复原始的SSL上下文
            ssl._create_default_https_context = original_ssl_context
    
    def _process_with_nvidia_api(self):
        """使用NVIDIA API处理音频"""
        # 初始化ASR服务
        debug_msg = "初始化ASR服务...\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        auth = Auth(
            uri=self.server, 
            use_ssl=True, 
            metadata_args=[
                ["function-id", self.function_id],
                ["authorization", f"Bearer {self.api_key}"]
            ]
        )
        
        debug_msg = "ASR服务初始化成功\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        asr_service = ASRService(auth)
        
        # 读取音频文件
        debug_msg = "读取音频文件...\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        file_size = os.path.getsize(self.audio_file_path)
        debug_msg = f"音频文件大小: {file_size/1024/1024:.2f} MB\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        # 检查文件格式，如果不支持则转换
        file_ext = os.path.splitext(self.audio_file_path)[1].lower()
        supported_formats = ['.wav', '.opus', '.flac']
        
        if file_ext not in supported_formats:
            debug_msg = f"文件格式 {file_ext} 不被支持，需要转换为WAV格式\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 使用ffmpeg转换为WAV格式
            try:
                temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                self.temp_wav_path = temp_wav.name
                temp_wav.close()
                
                debug_msg = f"使用ffmpeg转换音频到WAV格式: {self.temp_wav_path}\n"
                self.root.after(0, self._add_debug, debug_msg)
                
                # 使用ffmpeg转换音频
                result = subprocess.run(
                    ['ffmpeg', '-i', self.audio_file_path, '-ar', '16000', '-ac', '1', '-y', self.temp_wav_path],
                    capture_output=True,
                    text=True,
                    timeout=300  # 5分钟超时
                )
                
                if result.returncode != 0:
                    debug_msg = f"ffmpeg转换失败: {result.stderr}\n"
                    self.root.after(0, self._add_debug, debug_msg)
                    raise Exception(f"音频转换失败: {result.stderr}")
                
                debug_msg = "音频转换成功\n"
                self.root.after(0, self._add_debug, debug_msg)
                
                # 使用转换后的WAV文件
                self.audio_file_path = self.temp_wav_path
                file_ext = '.wav'
                
            except FileNotFoundError:
                debug_msg = "ffmpeg未安装，尝试使用原始文件\n"
                self.root.after(0, self._add_debug, debug_msg)
                # 如果没有ffmpeg，继续使用原始文件（可能会失败）
            except subprocess.TimeoutExpired:
                debug_msg = "音频转换超时\n"
                self.root.after(0, self._add_debug, debug_msg)
                raise Exception("音频转换超时")
            except Exception as e:
                debug_msg = f"音频转换出错: {str(e)}\n"
                self.root.after(0, self._add_debug, debug_msg)
                raise
        
        # 配置ASR参数
        debug_msg = "配置ASR参数...\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        import riva.client.proto.riva_asr_pb2 as rasr
        import riva.client.proto.riva_audio_pb2 as raud
        
        # 根据文件扩展名确定音频编码
        encoding = raud.AudioEncoding.LINEAR_PCM  # 默认编码
        
        if file_ext == '.wav':
            encoding = raud.AudioEncoding.LINEAR_PCM
        elif file_ext == '.opus':
            encoding = raud.AudioEncoding.OGGOPUS
        elif file_ext == '.flac':
            encoding = raud.AudioEncoding.FLAC
        
        debug_msg = f"使用音频编码: {encoding}\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        # 显示选择的语言
        selected_language = self.language_var.get()
        debug_msg = f"选择的语言: {selected_language}\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        # 配置基础参数
        config = rasr.RecognitionConfig(
            language_code=self.language_var.get(),  # 使用用户选择的语言
            max_alternatives=1,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,  # 启用词级时间偏移，改善断句
            profanity_filter=False,  # 不过滤内容，保持原样
            encoding=encoding,
            sample_rate_hertz=16000  # 设置采样率为16kHz
        )
        
        # 执行转录
        debug_msg = "执行转录...\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        # 使用离线API处理
        debug_msg = "使用离线API处理...\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        try:
            # 读取音频文件
            with open(self.audio_file_path, 'rb') as fh:
                data = fh.read()
            
            data_size_mb = len(data) / 1024 / 1024
            debug_msg = f"音频文件读取成功，大小: {data_size_mb:.2f} MB\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 使用离线API
            response = asr_service.offline_recognize(data, config)
            
            debug_msg = "离线API转录完成\n"
            self.root.after(0, self._add_debug, debug_msg)
            
        except Exception as e:
            debug_msg = f"处理音频文件时出错: {str(e)}\n"
            self.root.after(0, self._add_debug, debug_msg)
            raise
        
        # 收集结果
        all_sentences = []  # 存储所有句子
        debug_msg = f"响应结果数量: {len(response.results)}\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        for i, result in enumerate(response.results):
            debug_msg = f"结果 #{i}: 类型={type(result)}, 属性={dir(result)}\n"
            self.root.after(0, self._add_debug, debug_msg)
            
            # 直接检查result对象是否有alternatives属性，不再依赖is_final
            if hasattr(result, 'alternatives'):
                debug_msg = f"结果 #{i} alternatives数量: {len(result.alternatives)}\n"
                self.root.after(0, self._add_debug, debug_msg)
                
                if len(result.alternatives) > 0:
                    # 检查alternative对象是否有transcript属性
                    if hasattr(result.alternatives[0], 'transcript'):
                        transcript_text = result.alternatives[0].transcript
                        debug_msg = f"原始转录文本: {transcript_text}\n"
                        self.root.after(0, self._add_debug, debug_msg)
                        
                        # 根据标点符号分割句子，每句一行
                        import re
                        # 处理连续标点符号，只在最后一个符号处断句
                        # 先找到所有的标点符号位置
                        punct_positions = []
                        for match in re.finditer(r'([.!?。！？，；；、]+)', transcript_text):
                            punct_positions.append(match.start())
                        
                        if punct_positions:
                            # 按位置分割文本
                            prev_pos = 0
                            for pos in punct_positions:
                                # 获取句子部分
                                sentence_part = transcript_text[prev_pos:pos].strip()
                                if sentence_part:
                                    # 检查是否有连续标点符号
                                    remaining_text = transcript_text[pos:]
                                    consecutive_puncts = re.match(r'^([.!?。！？，；；、]+)', remaining_text)
                                    if consecutive_puncts:
                                        # 只取最后一个标点符号
                                        last_punct = consecutive_puncts.group(1)[-1]
                                        sentence_part += last_punct
                                        # 更新位置，跳过连续的标点符号
                                        prev_pos = pos + len(consecutive_puncts.group(1))
                                    else:
                                        # 单个标点符号
                                        sentence_part += transcript_text[pos]
                                        prev_pos = pos + 1
                                    
                                    all_sentences.append(sentence_part)
                                    debug_msg = f"添加句子: {sentence_part}\n"
                                    self.root.after(0, self._add_debug, debug_msg)
                            
                            # 处理最后的部分
                            if prev_pos < len(transcript_text):
                                last_part = transcript_text[prev_pos:].strip()
                                if last_part:
                                    # 确保有标点符号
                                    if not last_part.endswith(('.', '!', '?', '。', '！', '？', '，', '；', '；', '、')):
                                        last_part += '。'
                                    all_sentences.append(last_part)
                                    debug_msg = f"添加句子: {last_part}\n"
                                    self.root.after(0, self._add_debug, debug_msg)
                        else:
                            # 没有标点符号，整个文本作为一句
                            if transcript_text:
                                if not transcript_text.endswith(('.', '!', '?', '。', '！', '？', '，', '；', '；', '、')):
                                    transcript_text += '。'
                                all_sentences.append(transcript_text)
                                debug_msg = f"添加句子: {transcript_text}\n"
                                self.root.after(0, self._add_debug, debug_msg)
                    else:
                        debug_msg = f"结果 #{i} 的alternative没有transcript属性\n"
                        self.root.after(0, self._add_debug, debug_msg)
                else:
                    debug_msg = f"结果 #{i} 没有alternatives\n"
                    self.root.after(0, self._add_debug, debug_msg)
            else:
                debug_msg = f"结果 #{i} 没有alternatives属性\n"
                self.root.after(0, self._add_debug, debug_msg)
        
        # 使用换行符连接每个句子，每句一行
        final_text = "\n".join(all_sentences)
        debug_msg = f"最终转录文本: {final_text}\n"
        self.root.after(0, self._add_debug, debug_msg)
        
        # 更新UI
        self.root.after(0, self._update_result, final_text)
    
    def _update_result(self, text):
        # 显示结果
        self.result_text.delete(1.0, tk.END)
        self.result_text.insert(tk.END, text)
        
        # 保存结果到文件
        if self.audio_file_path:
            # 使用原始文件名（不是转换后的临时文件名）
            original_file_name = os.path.basename(self.file_path_var.get())
            txt_file_name = os.path.splitext(original_file_name)[0] + ".txt"
            txt_file_path = os.path.join(os.path.dirname(self.file_path_var.get()), txt_file_name)
            
            with open(txt_file_path, "w", encoding="utf-8") as f:
                f.write(text)
            self.status_var.set(f"处理完成，结果已保存到: {txt_file_name}")
        else:
            self.status_var.set("处理完成")
    
    def _show_error(self, error_msg):
        messagebox.showerror("错误", error_msg)
        self.status_var.set("处理失败")
    
    def _restore_buttons(self):
        self.process_btn.config(state=tk.NORMAL)
        self.browse_btn.config(state=tk.NORMAL)
    
    def _add_debug(self, message):
        """添加调试信息到调试文本框"""
        self.debug_text.insert(tk.END, message)
        self.debug_text.see(tk.END)
    
    def _clear_debug(self):
        """清空调试信息文本框"""
        self.debug_text.delete(1.0, tk.END)

if __name__ == "__main__":
    root = tk.Tk()
    app = ASRGUI(root)
    root.mainloop()