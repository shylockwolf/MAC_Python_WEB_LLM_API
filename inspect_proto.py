
import sys
import os
# Add python-clients to path as asr_gui.py does
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-clients'))

try:
    import riva.client.proto.riva_asr_pb2 as rasr
    print("Successfully imported riva_asr_pb2")
    print(f"Package: {rasr.DESCRIPTOR.package}")
    
    service = rasr.DESCRIPTOR.services_by_name.get('RivaSpeechRecognition')
    if service:
        print(f"Service: {service.full_name}")
        for method in service.methods:
            print(f"Method: {method.name}, Input: {method.input_type.full_name}, Output: {method.output_type.full_name}")
    else:
        print("Service RivaSpeechRecognition not found in descriptor")

except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
