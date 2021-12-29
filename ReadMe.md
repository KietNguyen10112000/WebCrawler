
# **Hướng dẫn chạy**

**_RabbitMQ và MongoDB chỉ chạy trên máy master_**

## **1. RabbitMQ**
### Cài đặt (lên trang chủ xem)
### Cấu hình
**Tạo file cấu hình theo đường dẫn**
    Windows : `C:\Users\<User name>\AppData\Roaming\RabbitMQ\rabbitmq.conf`
    Linux   : `/etc/rabbitmq/rabbitmq.conf`

**Thêm nội dung sau vào file cấu hình**
    `log.console = true`
    `listeners.tcp.1 = <Your public IP address>:5672`

### Chạy server
Mở terminal
**`cd` đến:**
    Windows: `Nơi cài RabbitMQ>/sbin`
    Linux: tương tự

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**

**Chạy server**: 
    `rabbitmq-server`
**Thêm user**: (thêm use test với password 123456)
    `rabbitmqctl add_user test 123456` 
**Đổi quyền cho user**: (đổi quyền cho user test sang all permission)
    `rabbitmqctl set_permissions test .* .* .*` 



## **2. MongoDB**
### Cài đặt (lên trang chủ xem)
### Cấu hình
Tạo Database với tên **WebCrawler**
Tạo các collection **Article, ParsedURL, InQueueURL**

### Chạy
Mở terminal
**`cd` đến:**
    Windows: `<Nơi cài MongoDB>/bin`
    Linux: tương tự

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**

Chạy lần lượt:
    `mkdir mongodb27017`
    `mongod --bind_ip <Your public IP address> --port 27017 --dbpath ./mongodb27017`



## **3. WebCrawler**
### Clone repo (git clone)
### Cấu hình
Mở file `.env` để cấu hình
Trong file `.env`, sửa `192.168.1.8` thành `public ip address của máy master (máy chạy RabbitMQ với MongoDB)`

### Chạy
**Chạy RabbitMQ và MongoDB trên máy master như bên trên trước**

Mở terminal
**`cd` đến:**
    Windows: `<Repo>/WebCrawler`
    Linux: tương tự

**_Note: Tất cả các lệnh sau đều chạy dưới đường dẫn trên_**

**Npm install package**
    `npm install`

**Clear RabbitMQ Queue**
Mở file cấu hình `.env` sửa `RABBITMQ_CLEAR=true`, save lại

Chạy lần lượt:
    `node node_modules/typescript/lib/tsc -p ./`
    `node --es-module-specifier-resolution=node ./out/index.js`

Mở file cấu hình `.env` sửa lại `RABBITMQ_CLEAR=false`, save lại

**Chạy một worker**:

**_Mỗi một terminal có thể chạy 1 worker riêng biệt, có thể chạy 2 - 4 workers trên máy master, 4 - 8 workers trên các máy khác_**

Chạy lần lượt:
    `node node_modules/typescript/lib/tsc -p ./`
    `node --es-module-specifier-resolution=node ./out/index.js`
Lặp lại các lệnh trên trên nhiều terminal khác nhau để chạy các worker khác (không cần clear lại RabbitMQ queue)