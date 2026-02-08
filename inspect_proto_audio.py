
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-clients'))

try:
    import riva.client.proto.riva_audio_pb2 as raud
    print("Successfully imported riva_audio_pb2")
    print(f"Package: {raud.DESCRIPTOR.package}")
    
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
