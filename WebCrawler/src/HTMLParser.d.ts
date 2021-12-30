interface ParsedArticle {
  tag: String
  URL: String
  title: String
  content: String
  author: String
  //array of string contains new links (that need to push to RabbitMQ)
  links: Array<String>
}

interface HTMLParser {
  Hello(): String
  ParseArticle(html: String): ParsedArticle
  ParseExternalLinks(html: String): Array<String>
}