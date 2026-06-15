# import torch
# model.to(device)
# device = "cuda" if torch.cuda.is_available() else "cpu"
# print(f"Using device: {device}")

import torch
print("CUDA Available:", torch.cuda.is_available())
print("Device Name:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "No GPU Found")
