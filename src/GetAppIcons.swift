import Cocoa

let arguments = CommandLine.arguments
guard arguments.count > 2 else {
    print("Error: No app path or destination path provided")
    exit(1)
}

let appName = arguments[1]
let destinationPath = arguments[2]

func getAppIcon(appName: String, saveLocation: String) {
    let appPath = "/Applications/\(appName).app"
    let icon: Optional<NSImage> = NSWorkspace.shared.icon(forFile: appPath)
    if let icon = icon {
        let imageData = icon.tiffRepresentation
        let bitmap = NSBitmapImageRep(data: imageData!)
        guard let pngData = bitmap?.representation(using: .png, properties: [:]), !pngData.isEmpty else {
            print("Error: Invalid PNG data")
            exit(1)
        }
        do {
            try pngData.write(to: URL(fileURLWithPath: saveLocation))
        } catch {
            print("Error: could not save to \(saveLocation)")
            exit(1)
        }
    }
    else {
        print("Error: Could not extract icon")
        exit(1)
    }
}

getAppIcon(appName: appName, saveLocation: destinationPath)
// getAppIcon(appName: "Arc", saveLocation: "/Users/miles/Code Projects/Random Temp/SavedIcons/Arc.png")