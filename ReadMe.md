
# **Hướng dẫn chạy**

**_RabbitMQ và MongoDB chỉ chạy trên máy master_**

## **1. RabbitMQ**
### Cài đặt (lên trang chủ xem)
### Cấu hình
**Tạo file cấu hình theo đường dẫn** <br>
&nbsp;&nbsp;&nbsp;&nbsp;Windows : `C:\Users\<User name>\AppData\Roaming\RabbitMQ\rabbitmq.conf` <br>
&nbsp;&nbsp;&nbsp;&nbsp;Linux   : `/etc/rabbitmq/rabbitmq.conf`

**Thêm nội dung sau vào file cấu hình**  
&nbsp;&nbsp;&nbsp;&nbsp;`log.console = true`  <br>
&nbsp;&nbsp;&nbsp;&nbsp;`listeners.tcp.1 = <Your public IP address>:5672`

### Chạy server
Mở terminal <br>
**`cd` đến:**  <br>
&nbsp;&nbsp;&nbsp;&nbsp;Windows: `<Nơi cài RabbitMQ>/sbin`  
&nbsp;&nbsp;&nbsp;&nbsp;Linux: tương tự  

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**  

**Chạy server**:   <br>
&nbsp;&nbsp;&nbsp;&nbsp;`rabbitmq-server`  <br>
**Thêm user**: (thêm use test với password 123456)  <br>
&nbsp;&nbsp;&nbsp;&nbsp;`rabbitmqctl add_user test 123456`   <br>
**Đổi quyền cho user**: (đổi quyền cho user test sang all permission)  <br>
&nbsp;&nbsp;&nbsp;&nbsp;`rabbitmqctl set_permissions test .* .* .*`   <br>



## **2. MongoDB**
### Cài đặt (lên trang chủ xem)
### Cấu hình
Tạo Database với tên **WebCrawler**
Tạo các collection **Article, ParsedURL, InQueueURL**

### Chạy
Mở terminal <br>
**`cd` đến:**  <br>
&nbsp;&nbsp;&nbsp;&nbsp;Windows: `<Nơi cài MongoDB>/bin`  <br>
&nbsp;&nbsp;&nbsp;&nbsp;Linux: tương tự

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**

Chạy lần lượt: <br>
&nbsp;&nbsp;&nbsp;&nbsp;`mkdir mongodb27017` <br>
&nbsp;&nbsp;&nbsp;&nbsp;`mongod --bind_ip <Your public IP address> --port 27017 --dbpath ./mongodb27017` <br>



## **3. WebCrawler**
### Clone repo (git clone)  <br>
### Cấu hình  <br>
Mở file `.env` để cấu hình <br>
Trong file `.env`, sửa `192.168.1.8` thành `public ip address của máy master (máy chạy RabbitMQ với MongoDB)`

### Chạy
**Chạy RabbitMQ và MongoDB trên máy master như bên trên trước**

Mở terminal <br>
**`cd` đến:** <br>
&nbsp;&nbsp;&nbsp;&nbsp;Windows: `<Repo>/WebCrawler` <br>
&nbsp;&nbsp;&nbsp;&nbsp;Linux: tương tự <br>

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**

**Npm install package**  <br>
&nbsp;&nbsp;&nbsp;&nbsp;`npm install`

**Clear RabbitMQ Queue**  <br>
Mở file cấu hình `.env` sửa `RABBITMQ_CLEAR=true`, save lại <br>

Chạy lần lượt: <br>
&nbsp;&nbsp;&nbsp;&nbsp;`node node_modules/typescript/lib/tsc -p ./` <br>
&nbsp;&nbsp;&nbsp;&nbsp;`node --es-module-specifier-resolution=node ./out/index.js` <br>

Mở file cấu hình `.env` sửa lại `RABBITMQ_CLEAR=false`, save lại <br>

**Chạy một worker**:

**_Mỗi một terminal có thể chạy 1 worker riêng biệt, có thể chạy 2 - 4 workers trên máy master, 4 - 8 workers trên các máy khác_**

Chạy lần lượt: <br>
&nbsp;&nbsp;&nbsp;&nbsp;`node node_modules/typescript/lib/tsc -p ./` <br>
&nbsp;&nbsp;&nbsp;&nbsp;`node --es-module-specifier-resolution=node ./out/index.js` <br>
Lặp lại các lệnh trên trên nhiều terminal khác nhau để chạy các worker khác (không cần clear lại RabbitMQ queue)
