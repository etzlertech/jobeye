import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskImageUpload } from '@/components/tasks/TaskImageUpload';
import { imageProcessor } from '@/utils/image-processor';

jest.mock('@/utils/image-processor', () => ({
  imageProcessor: {
    processImage: jest.fn(),
  },
}));

const mockProcessImage = imageProcessor.processImage as jest.MockedFunction<typeof imageProcessor.processImage>;

const processedImages = {
  thumbnail: 'thumb',
  medium: 'medium',
  full: 'full',
};

describe('TaskImageUpload', () => {
  beforeEach(() => {
    mockProcessImage.mockReset();
    mockProcessImage.mockResolvedValue(processedImages);
  });

  it('renders preview mode with default label', () => {
    render(<TaskImageUpload onImageCapture={jest.fn()} />);
    expect(screen.getByText('Task Image')).toBeInTheDocument();
    expect(screen.getByText('Take Photo')).toBeInTheDocument();
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('displays current image when provided', () => {
    render(<TaskImageUpload onImageCapture={jest.fn()} currentImageUrl="http://example.com/image.jpg" />);
    const image = screen.getByAltText('Task preview') as HTMLImageElement;
    expect(image).toHaveAttribute('src', 'http://example.com/image.jpg');
  });

  it('calls onRemove when remove button clicked', () => {
    const handleRemove = jest.fn();
    render(
      <TaskImageUpload
        onImageCapture={jest.fn()}
        currentImageUrl="preview"
        onRemove={handleRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /remove image/i }));
    expect(handleRemove).toHaveBeenCalled();
  });

  it('does not render remove button without onRemove handler', () => {
    render(<TaskImageUpload onImageCapture={jest.fn()} currentImageUrl="preview" />);
    expect(screen.queryByRole('button', { name: /remove image/i })).toBeNull();
  });

  it('opens upload mode and processes selected file', async () => {
    const handleCapture = jest.fn();
    render(<TaskImageUpload onImageCapture={handleCapture} />);

    fireEvent.click(screen.getByText('Upload File'));

    const fileInput = screen.getByLabelText('Task image file input') as HTMLInputElement;

    const file = new File(['(⌐□_□)'], 'task.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockProcessImage).toHaveBeenCalledWith(file);
      expect(handleCapture).toHaveBeenCalledWith(processedImages);
    });
  });

  it('disables actions when disabled prop is true', () => {
    render(<TaskImageUpload onImageCapture={jest.fn()} disabled />);

    expect(screen.getByText('Take Photo')).toBeDisabled();
    expect(screen.getByText('Upload File')).toBeDisabled();
  });
});
