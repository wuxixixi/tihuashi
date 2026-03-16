import { useState, useEffect, useRef } from 'react'

/**
 * 懒加载图片组件
 * 使用 Intersection Observer API 实现图片懒加载
 */
export default function LazyImage({
  src,
  alt,
  className,
  style,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E加载中...%3C/text%3E%3C/svg%3E',
  threshold = 0.1,
  rootMargin = '100px'
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className || ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        width: style?.width || '100%',
        height: style?.height || '100%',
        ...style
      }}
    >
      {/* 占位图 */}
      {!isLoaded && (
        <img
          src={placeholder}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: style?.objectFit || 'cover',
            filter: 'blur(10px)',
            transition: 'opacity 0.3s'
          }}
        />
      )}

      {/* 实际图片 */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: style?.objectFit || 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      )}

      {/* 错误提示 */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#999',
            fontSize: '0.9rem'
          }}
        >
          图片加载失败
        </div>
      )}
    </div>
  )
}
