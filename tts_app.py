import os
import tkinter as tk
from tkinter import filedialog, messagebox
import tkinter.ttk as ttk
import wave
import sys
import requests
import json
import grpc
from dotenv import load_dotenv
from piper import PiperVoice

# Load environment variables
load_dotenv()

# Try to import NVIDIA Riva client
try:
    from riva.client.tts import SpeechSynthesisService, AudioEncoding
    from riva.client.auth import Auth
    RIVA_AVAILABLE = True
except ImportError:
    RIVA_AVAILABLE = False

class TTSApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Piper TTS Generator")
        self.root.geometry("600x600")  # Larger initial size to fit debug console

        # Variables
        self.model_path = tk.StringVar()
        self.text_file_path = tk.StringVar()
        self.status_var = tk.StringVar(value="Ready")
        self.available_models = []
        self.tts_mode = tk.StringVar(value="local")  # local or api
        self.api_voice = tk.StringVar(value="Magpie-Multilingual.EN-US.Aria")
        self.debug_text = None
        self.debug_buffer = []  # Buffer for debug messages

        # Initialize UI
        self.create_menu()
        self.create_widgets()
        
        # Load models on startup
        self.load_models()

    def create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # File Menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Open Text File...", command=self.select_text_file)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        
        # Help Menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=lambda: messagebox.showinfo("About", "Piper TTS Generator\nPowered by Piper TTS"))
        help_menu.add_separator()
        help_menu.add_command(label="Debug Window", command=self.open_debug_window)

    def create_widgets(self):
        # Main container with padding
        main_frame = tk.Frame(self.root, padx=15, pady=15)
        main_frame.pack(fill="both", expand=True)

        # TTS Mode Selection
        mode_frame = tk.LabelFrame(main_frame, text="TTS Mode", padx=10, pady=10)
        mode_frame.pack(fill="x", pady=(0, 10))

        tk.Label(mode_frame, text="Select Mode:").grid(row=0, column=0, sticky="w", padx=(0, 5))
        
        mode_frame.columnconfigure(1, weight=1)
        
        # Radio buttons for mode selection
        tk.Radiobutton(mode_frame, text="Local Model", variable=self.tts_mode, value="local", command=self.update_ui_based_on_mode).grid(row=0, column=1, sticky="w", padx=5)
        tk.Radiobutton(mode_frame, text="NVIDIA Magpie API", variable=self.tts_mode, value="api", command=self.update_ui_based_on_mode).grid(row=0, column=2, sticky="w", padx=5)

        # Model Selection (Local)
        self.model_frame = tk.LabelFrame(main_frame, text="Local Model Configuration", padx=10, pady=10)
        self.model_frame.pack(fill="x", pady=(0, 10))

        tk.Label(self.model_frame, text="Select Voice:").grid(row=0, column=0, sticky="w", padx=(0, 5))
        
        self.model_combobox = ttk.Combobox(self.model_frame, textvariable=self.model_path, width=50, state="readonly")
        self.model_combobox.grid(row=0, column=1, padx=5, sticky="ew")
        
        tk.Button(self.model_frame, text="Refresh", command=self.load_models).grid(row=0, column=2, padx=5)

        # API Configuration
        self.api_frame = tk.LabelFrame(main_frame, text="NVIDIA Magpie API Configuration", padx=10, pady=10)
        self.api_frame.pack(fill="x", pady=(0, 10))

        tk.Label(self.api_frame, text="Select Voice:").grid(row=0, column=0, sticky="w", padx=(0, 5))
        
        self.api_voice_combobox = ttk.Combobox(self.api_frame, textvariable=self.api_voice, width=50, state="readonly")
        self.api_voice_combobox['values'] = [
            "Magpie-Multilingual.EN-US.Aria",
            "Magpie-Multilingual.EN-US.Jason",
            "Magpie-Multilingual.EN-US.Leo",
            "Magpie-Multilingual.EN-US.Sofia",
            "Magpie-Multilingual.EN-US.Mia",
            "Magpie-Multilingual.EN-US.Aria.Neutral",
            "Magpie-Multilingual.EN-US.Aria.Happy",
            "Magpie-Multilingual.EN-US.Aria.Sad",
            "Magpie-Multilingual.EN-US.Aria.Calm"
        ]
        self.api_voice_combobox.grid(row=0, column=1, padx=5, sticky="ew")

        # Update UI based on initial mode
        self.update_ui_based_on_mode()

        # File Selection
        file_frame = tk.LabelFrame(main_frame, text="Text File Selection", padx=10, pady=10)
        file_frame.pack(fill="x", pady=(0, 10))

        tk.Label(file_frame, text="Text File:").grid(row=0, column=0, sticky="w", padx=(0, 5))
        tk.Entry(file_frame, textvariable=self.text_file_path, width=40).grid(row=0, column=1, padx=5, sticky="ew")
        tk.Button(file_frame, text="Browse...", command=self.select_text_file).grid(row=0, column=2, padx=5)

        # Generate Button
        tk.Button(main_frame, text="Generate Audio", command=self.generate_audio, bg="#4CAF50", fg="black", font=("Arial", 12, "bold"), height=2).pack(fill="x", pady=10)

        # Debug Area (inside main_frame, below Generate Audio button)
        self.debug_frame = tk.LabelFrame(main_frame, text="Debug Console", padx=10, pady=10)
        # Initially visible
        self.debug_frame.pack(fill="both", expand=True, pady=(10, 0))
        
        # Create text widget for debug output
        self.debug_text = tk.Text(self.debug_frame, wrap="word", font=("Courier New", 10), height=10)
        self.debug_text.pack(fill="both", expand=True)
        
        # Add scrollbar
        scrollbar = tk.Scrollbar(self.debug_text, command=self.debug_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.debug_text.config(yscrollcommand=scrollbar.set)
        
        # Add clear button
        clear_button = tk.Button(self.debug_frame, text="Clear", command=self.clear_debug)
        clear_button.pack(side="bottom", padx=10, pady=5)

        # Status Bar
        status_bar = tk.Label(self.root, textvariable=self.status_var, relief="sunken", anchor="w", padx=5)
        status_bar.pack(side="bottom", fill="x")

        # Grid configuration
        self.model_frame.columnconfigure(1, weight=1)
        self.api_frame.columnconfigure(1, weight=1)
        file_frame.columnconfigure(1, weight=1)

    def update_ui_based_on_mode(self):
        """Update UI elements based on selected TTS mode"""
        mode = self.tts_mode.get()
        if mode == "local":
            self.model_frame.pack(fill="x", pady=(0, 10))
            self.api_frame.pack_forget()
        else:
            self.model_frame.pack_forget()
            self.api_frame.pack(fill="x", pady=(0, 10))

    def open_debug_window(self):
        """Toggle debug console visibility in main window"""
        if self.debug_frame.winfo_ismapped():
            # Hide debug console
            self.debug_frame.pack_forget()
            self.debug_print("Debug console hidden.")
        else:
            # Show debug console
            self.debug_frame.pack(fill="both", expand=True, pady=(10, 0))
            self.debug_print("Debug console opened.")
            
            # Display buffered messages
            if self.debug_buffer:
                # Clear existing content first
                self.debug_text.delete(1.0, tk.END)
                self.debug_print(f"Displaying {len(self.debug_buffer)} buffered messages...")
                for msg in self.debug_buffer:
                    self.debug_text.insert(tk.END, msg)
                self.debug_text.see(tk.END)

    def debug_print(self, message):
        """Print message to debug console"""
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        debug_message = f"[{timestamp}] {message}\n"
        
        # Add to buffer
        self.debug_buffer.append(debug_message)
        
        # If debug console is visible, print to it
        if self.debug_text and self.debug_frame.winfo_ismapped():
            self.debug_text.insert(tk.END, debug_message)
            self.debug_text.see(tk.END)  # Auto-scroll to end

    def clear_debug(self):
        """Clear debug console content"""
        if self.debug_text:
            self.debug_text.delete(1.0, tk.END)
            self.debug_print("Debug console cleared.")

    def load_models(self):
        models_dir = os.path.join(os.getcwd(), "models")
        self.debug_print(f"Loading models from directory: {models_dir}")
        
        if not os.path.exists(models_dir):
            self.debug_print(f"Creating models directory: {models_dir}")
            os.makedirs(models_dir)
        
        self.available_models = []
        try:
            files = os.listdir(models_dir)
            self.debug_print(f"Found files in models directory: {files}")
            
            for f in files:
                if f.endswith(".onnx"):
                    full_path = os.path.join(models_dir, f)
                    self.available_models.append(full_path)
                    self.debug_print(f"Added model: {f}")
        except Exception as e:
            self.debug_print(f"Error loading models: {e}")
            messagebox.showerror("Error", f"Failed to load models: {e}")

        if self.available_models:
            # Update combobox values to show filenames only, but store full path in logic if needed
            # Actually, let's just show filenames in the box
            display_names = [os.path.basename(m) for m in self.available_models]
            self.model_combobox['values'] = display_names
            if display_names:
                self.model_combobox.current(0) # Select first one
                self.model_path.set(display_names[0])
                self.debug_print(f"Selected default model: {display_names[0]}")
            self.status_var.set(f"Loaded {len(self.available_models)} models.")
            self.debug_print(f"Loaded {len(self.available_models)} models successfully.")
        else:
            self.model_combobox['values'] = []
            self.status_var.set("No models found in ./models directory.")
            self.debug_print("No models found in ./models directory.")
            messagebox.showinfo("No Models", "No voice models found in the 'models' folder.\nPlease download a .onnx model and its .json config.")

    def select_text_file(self):
        filename = filedialog.askopenfilename(
            title="Select Text File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
        )
        if filename:
            self.text_file_path.set(filename)
            self.debug_print(f"Selected text file: {filename}")

    def generate_audio(self):
        text_file = self.text_file_path.get()

        if not text_file or not os.path.exists(text_file):
            messagebox.showerror("Error", "Please select a valid text file.")
            return

        # Determine output filename
        base_name = os.path.splitext(text_file)[0]
        output_wav = f"{base_name}.wav"
        self.debug_print(f"Output file will be saved to: {output_wav}")

        # Read text from file
        try:
            with open(text_file, 'r', encoding='utf-8') as f:
                text = f.read()
            self.debug_print(f"Read text from file: {text_file}")
            self.debug_print(f"Text content (first 100 chars): {text[:100]}...")
        except Exception as e:
            self.debug_print(f"Error reading text file: {str(e)}")
            messagebox.showerror("Error", f"Failed to read text file: {str(e)}")
            return

        # Get selected mode
        mode = self.tts_mode.get()
        self.debug_print(f"Selected TTS mode: {mode}")

        if mode == "local":
            # Local model processing
            self.debug_print("Starting local model processing...")
            self.generate_audio_local(output_wav, text)
        else:
            # API processing
            self.debug_print("Starting NVIDIA Magpie API processing...")
            self.generate_audio_api(output_wav, text)

    def generate_audio_local(self, output_wav, text):
        """Generate audio using local model"""
        selected_model_name = self.model_path.get()
        if not selected_model_name:
             messagebox.showerror("Error", "Please select a voice model.")
             return

        # Find full path
        models_dir = os.path.join(os.getcwd(), "models")
        model_file = os.path.join(models_dir, selected_model_name)
        self.debug_print(f"Using local model: {model_file}")

        if not os.path.exists(model_file):
            # Fallback if user manually entered a path or something weird happened
            if os.path.exists(selected_model_name):
                model_file = selected_model_name
                self.debug_print(f"Using fallback model path: {model_file}")
            else:
                self.debug_print(f"Model file not found: {model_file}")
                messagebox.showerror("Error", f"Model file not found: {model_file}")
                return

        self.status_var.set("Loading model...")
        self.root.update()
        self.debug_print("Loading model...")

        try:
            voice = PiperVoice.load(model_file)
            self.debug_print("Model loaded successfully")
            
            self.status_var.set("Synthesizing audio...")
            self.root.update()
            self.debug_print("Synthesizing audio...")

            # Synthesize
            with wave.open(output_wav, "wb") as wav_file:
                voice.synthesize_wav(text, wav_file)
            self.debug_print(f"Audio synthesized successfully and saved to: {output_wav}")

            self.status_var.set(f"Done! Saved to {os.path.basename(output_wav)}")
            messagebox.showinfo("Success", f"Audio generated successfully:\n{output_wav}")

        except Exception as e:
            self.status_var.set("Error occurred")
            self.debug_print(f"Error during local audio generation: {str(e)}")
            messagebox.showerror("Error", str(e))
            print(e)

    def generate_audio_api(self, output_wav, text):
        """Generate audio using NVIDIA Magpie TTS API via gRPC"""
        # Check if Riva client is available
        if not RIVA_AVAILABLE:
            self.debug_print("NVIDIA Riva client not available. Please install: pip install nvidia-riva-client")
            messagebox.showerror("Error", "NVIDIA Riva client not available. Please install: pip install nvidia-riva-client")
            return

        # Get API key from environment variable
        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            self.debug_print("NVIDIA_API_KEY not found in .env file")
            messagebox.showerror("Error", "NVIDIA_API_KEY not found in .env file")
            return
        else:
            self.debug_print("NVIDIA_API_KEY found in .env file")

        selected_voice = self.api_voice.get()
        if not selected_voice:
            self.debug_print("No voice selected for API")
            messagebox.showerror("Error", "Please select a voice for API.")
            return
        else:
            self.debug_print(f"Selected API voice: {selected_voice}")

        self.status_var.set("Synthesizing audio via API...")
        self.root.update()
        self.debug_print("Synthesizing audio via NVIDIA Magpie API...")

        try:
            # NVIDIA Magpie TTS gRPC endpoint
            server_url = "grpc.nvcf.nvidia.com:443"
            function_id = "877104f7-e885-42b9-8de8-f6e4c6303969"
            self.debug_print(f"Connecting to gRPC server: {server_url}")
            self.debug_print(f"Function ID: {function_id}")

            # Create Auth object with metadata for NVIDIA NIM
            auth = Auth(
                use_ssl=True,
                uri=server_url,
                metadata_args=[
                    ["function-id", function_id],
                    ["authorization", f"Bearer {api_key}"]
                ]
            )
            self.debug_print("Auth object created with metadata")

            # Create Riva TTS service
            tts_service = SpeechSynthesisService(auth)
            self.debug_print("Riva TTS service created")

            # Parse voice name to get language code
            # Auto-detect language from text content
            def is_chinese(text):
                chinese_chars = 0
                for char in text:
                    if ord(char) >= 0x4e00 and ord(char) <= 0x9fff:
                        chinese_chars += 1
                return chinese_chars > len(text) * 0.2  # If more than 20% Chinese characters
            
            if is_chinese(text):
                language_code = "zh-CN"
                self.debug_print(f"Detected Chinese language from text")
            else:
                language_code = "en-US"
                self.debug_print(f"Detected English language from text")
            
            self.debug_print(f"Language code: {language_code}")

            # Synthesize speech
            self.debug_print("Sending synthesis request...")
            response = tts_service.synthesize(
                text=text,
                voice_name=selected_voice,
                language_code=language_code,
                encoding=AudioEncoding.LINEAR_PCM,
                sample_rate_hz=22050
            )
            self.debug_print("Synthesis request completed")

            # Save the audio response
            self.debug_print(f"Saving audio response to: {output_wav}")
            with wave.open(output_wav, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(22050)
                wav_file.writeframes(response.audio)
            
            self.debug_print(f"Audio saved successfully: {output_wav}")

            self.status_var.set(f"Done! Saved to {os.path.basename(output_wav)}")
            messagebox.showinfo("Success", f"Audio generated successfully via NVIDIA Magpie API:\n{output_wav}")

        except Exception as e:
            self.status_var.set("Error occurred")
            self.debug_print(f"Error during API audio generation: {str(e)}")
            messagebox.showerror("Error", str(e))
            print(e)
        finally:
            # Clean up if needed
            try:
                if 'auth' in locals():
                    # Auth object will be garbage collected automatically
                    self.debug_print("Auth cleanup complete")
            except:
                pass

if __name__ == "__main__":
    root = tk.Tk()
    app = TTSApp(root)
    root.mainloop()
