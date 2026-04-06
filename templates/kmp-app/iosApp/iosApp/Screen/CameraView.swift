import SwiftUI
import PhotosUI
import UIKit

/// Photo gallery screen with real camera capture and photo picker.
///
/// Images are saved to the app's Documents directory and persist across launches.
/// Uses PHPickerViewController for gallery selection and UIImagePickerController
/// for camera capture (camera only available on physical devices).
struct CameraView: View {
    @StateObject private var store = PhotoStore()
    @State private var showCamera = false
    @State private var showPicker = false
    @State private var photoToDelete: StoredPhoto?
    @State private var showDeleteAlert = false

    var body: some View {
        VStack(spacing: 0) {
            // Action buttons
            HStack(spacing: 12) {
                Button {
                    showCamera = true
                } label: {
                    Text("Take Photo")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))

                Button {
                    showPicker = true
                } label: {
                    Text("Pick Image")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .padding()

            if store.photos.isEmpty {
                Spacer()
                VStack(spacing: 16) {
                    Text("\u{1F4F7}")
                        .font(.system(size: 48))
                    Text("No photos yet")
                        .font(.headline)
                    Text("Take a photo or pick one from your gallery")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                Spacer()
            } else {
                Text("\(store.photos.count) photo\(store.photos.count == 1 ? "" : "s") saved")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.bottom, 4)

                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 140), spacing: 8)
                    ], spacing: 8) {
                        ForEach(store.photos) { photo in
                            PhotoCard(photo: photo) {
                                photoToDelete = photo
                                showDeleteAlert = true
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 16)
                }
            }
        }
        .navigationTitle("Photos")
        // Camera sheet
        .fullScreenCover(isPresented: $showCamera) {
            CameraCaptureView { image in
                store.save(image: image)
            }
            .ignoresSafeArea()
        }
        // Photo picker sheet
        .sheet(isPresented: $showPicker) {
            PhotoPickerView { images in
                for image in images {
                    store.save(image: image)
                }
            }
        }
        // Delete confirmation
        .alert("Delete Photo", isPresented: $showDeleteAlert) {
            Button("Delete", role: .destructive) {
                if let photo = photoToDelete {
                    store.delete(photo)
                }
                photoToDelete = nil
            }
            Button("Cancel", role: .cancel) {
                photoToDelete = nil
            }
        } message: {
            Text("Remove this photo from saved photos?")
        }
    }
}

// MARK: - Photo Card

private struct PhotoCard: View {
    let photo: StoredPhoto
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                if let uiImage = UIImage(contentsOfFile: photo.filePath) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 140)
                        .frame(maxWidth: .infinity)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 140)
                        .overlay {
                            Image(systemName: "photo")
                                .font(.largeTitle)
                                .foregroundColor(.secondary)
                        }
                }

                Button(action: onDelete) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, .red)
                }
                .padding(6)
            }
            .frame(height: 140)
            .clipped()

            VStack(alignment: .leading, spacing: 2) {
                Text(photo.name)
                    .font(.caption)
                    .lineLimit(1)
                Text(photo.sizeLabel)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(8)
        }
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

// MARK: - Photo Store (local file persistence)

struct StoredPhoto: Identifiable, Codable {
    let id: String
    let name: String
    let fileName: String
    let timestamp: Date
    let sizeBytes: Int

    var filePath: String {
        PhotoStore.photosDirectory.appendingPathComponent(fileName).path
    }

    var sizeLabel: String {
        if sizeBytes > 1_000_000 {
            return String(format: "%.1f MB", Double(sizeBytes) / 1_000_000)
        } else {
            return "\(sizeBytes / 1024) KB"
        }
    }
}

class PhotoStore: ObservableObject {
    @Published var photos: [StoredPhoto] = []

    static let photosDirectory: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SavedPhotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private static let manifestURL: URL = {
        photosDirectory.appendingPathComponent("manifest.json")
    }()

    init() {
        loadManifest()
    }

    func save(image: UIImage) {
        let id = UUID().uuidString
        let fileName = "\(id).jpg"
        let fileURL = Self.photosDirectory.appendingPathComponent(fileName)

        // Compress to JPEG (0.8 quality balances size vs quality)
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }

        do {
            try data.write(to: fileURL)
        } catch {
            print("Failed to save photo: \(error)")
            return
        }

        let photo = StoredPhoto(
            id: id,
            name: "Photo \(photos.count + 1)",
            fileName: fileName,
            timestamp: Date(),
            sizeBytes: data.count
        )

        photos.insert(photo, at: 0)
        saveManifest()
    }

    func delete(_ photo: StoredPhoto) {
        // Remove file from disk
        let fileURL = Self.photosDirectory.appendingPathComponent(photo.fileName)
        try? FileManager.default.removeItem(at: fileURL)

        // Remove from list
        photos.removeAll { $0.id == photo.id }
        saveManifest()
    }

    private func saveManifest() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(photos) else { return }
        try? data.write(to: Self.manifestURL)
    }

    private func loadManifest() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = try? Data(contentsOf: Self.manifestURL),
              let loaded = try? decoder.decode([StoredPhoto].self, from: data)
        else { return }

        // Only keep photos whose files still exist on disk
        photos = loaded.filter { photo in
            FileManager.default.fileExists(atPath: photo.filePath)
        }
    }
}

// MARK: - Camera Capture (UIImagePickerController wrapper)

struct CameraCaptureView: UIViewControllerRepresentable {
    let onCapture: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onCapture: onCapture) }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onCapture: (UIImage) -> Void

        init(onCapture: @escaping (UIImage) -> Void) {
            self.onCapture = onCapture
        }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                onCapture(image)
            }
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - Photo Picker (PHPickerViewController wrapper)

struct PhotoPickerView: UIViewControllerRepresentable {
    let onPick: ([UIImage]) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 10
        config.filter = .images
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: ([UIImage]) -> Void

        init(onPick: @escaping ([UIImage]) -> Void) {
            self.onPick = onPick
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)

            var images: [UIImage] = []
            let group = DispatchGroup()

            for result in results {
                guard result.itemProvider.canLoadObject(ofClass: UIImage.self) else { continue }
                group.enter()
                result.itemProvider.loadObject(ofClass: UIImage.self) { object, _ in
                    if let image = object as? UIImage {
                        images.append(image)
                    }
                    group.leave()
                }
            }

            group.notify(queue: .main) { [self] in
                self.onPick(images)
            }
        }
    }
}

#Preview {
    NavigationStack {
        CameraView()
    }
}
