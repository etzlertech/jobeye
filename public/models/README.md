# YOLO Models Directory

## Required Model

**YOLOv11n ONNX Model** (Nano version for edge devices)

### Download Instructions

1. Visit: https://github.com/ultralytics/ultralytics/releases
2. Download `yolo11n.onnx` (or convert from PyTorch)
3. Place in this directory as `yolov11n.onnx`

### Alternative: Convert from PyTorch

```bash
pip install ultralytics
yolo export model=yolo11n.pt format=onnx
mv yolo11n.onnx public/models/yolov11n.onnx
```

### Model Specs
- **Size**: ~5MB
- **Input**: 640x640 RGB
- **Output**: Detection boxes with confidence scores
- **Performance**: <1s inference on modern devices

### IndexedDB Caching

The model is automatically cached in IndexedDB after first load to avoid repeated downloads (5MB per page load).