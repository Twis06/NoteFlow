# 测试各种图片链接格式

## 1. 标准Markdown相对路径
![测试图片1](./images/test1.png)
![测试图片2](images/test2.jpg)

## 2. Attachments目录
![附件图片](attachments/screenshot.png)
![另一个附件](attachments/diagram.svg)

## 3. Obsidian格式
![[obsidian-image.png]]
![[another-image.jpg]]

## 4. HTML img标签
<img src="./assets/html-image.png" alt="HTML图片">
<img src="local-image.gif" width="300">

## 5. 绝对路径（应该被忽略）
![网络图片](https://example.com/image.png)
![已经是CDN](https://imagedelivery.net/abc/image.png)