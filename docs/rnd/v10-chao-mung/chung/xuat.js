/* Xuất thẻ #c thành ảnh PNG ngay trong trang mẫu (cùng nguồn với app), dùng html-to-image 1.11.13 (MIT, chép ở
   chung/html-to-image.js). App gọi window.MAU_XUAT_PNG() qua iframe cùng nguồn; trả Blob PNG đúng kích thước khung
   (1080×1350 hoặc 1080×1080). Phông nhúng: html-to-image chỉ nhúng phông mà #c thật sự dùng. */
(function(){
async function veMotLan(c,w,h){
  return window.htmlToImage.toBlob(c,{width:w,height:h,canvasWidth:w,canvasHeight:h,pixelRatio:1,cacheBust:false,backgroundColor:null});
}
window.MAU_XUAT_PNG=async function(){
  await (window.MAU_SAN_SANG||Promise.resolve());
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const c=document.getElementById('c');
  const w=c.offsetWidth,h=c.offsetHeight;
  // Lần vẽ đầu để trình duyệt nạp phông đã nhúng vào ảnh SVG (lần đầu có thể còn phông dự phòng); lấy lần thứ hai.
  await veMotLan(c,w,h);
  const blob=await veMotLan(c,w,h);
  if(!blob)throw new Error('Không vẽ được ảnh');
  return {blob:blob,width:w,height:h};
};
})();
