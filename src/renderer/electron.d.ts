```typescript
import type { ElectronAPI } from '../main/preload'

declare global {
    interface Window {
        recognition: {
            recognize: (data: RecognitionRequest) => Promise<RecognitionResult>
            onStreamChunk: (callback: (content: string) => void) => () => void
        }
    }
}

export { }
```
