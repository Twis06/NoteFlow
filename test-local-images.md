# 测试本地图片链接

这个文件包含各种本地图片链接格式，用于测试批量替换功能：

## 1. 相对路径图片
![测试图片1](./test-image.png)
![测试图片2](images/sample.jpg)

## 2. Attachments目录图片
![附件图片](attachments/test-image.png)

## 3. Obsidian格式图片
![[CleanShot 2025-08-18 at 15.04.19@2x.png]]

## 4. HTML img标签
<img src="./test-image.png" alt="HTML图片">

## 5. 已经是CDN链接的图片（应该被跳过）
![CDN图片](https://imagedelivery.net/placeholder/obsidian-CleanShot)
![[https://cdn.example.com/image.png]]
<img src="https://example.com/image.jpg" alt="CDN HTML图片">