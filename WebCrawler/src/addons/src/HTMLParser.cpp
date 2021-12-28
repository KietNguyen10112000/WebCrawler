#include <node.h>

#include <string>
#include <iostream>
#include <map>
#include <vector>
#include <iomanip>
#include <sstream>

#include <pugixml.hpp>

extern "C"
{
#include <tidy.h>
#include <tidybuffio.h>
}

#ifdef WIN32
#include <Windows.h>
#endif //  WIN32

struct ParsedArticle
{
	std::string URL;
	std::string title;
	std::string content;
	std::string author;

	friend std::ostream& operator<<(std::ostream&, ParsedArticle& article)
	{
		std::cout
			<< "[TITLE]  "	<< std::setw(12) << ": " << article.title	<< "\n"
			<< "[URL]    "	<< std::setw(12) << ": " << article.URL		<< "\n"
			<< "[CONTENT]"	<< std::setw(12) << ": " << article.content	<< "\n"
			<< "[AUTHOR] "	<< std::setw(12) << ": " << article.author	<< "\n";

		return std::cout;
	}
};

struct XMLSign
{
	std::string name;
	std::map<std::string, std::string> attributes;
};

inline bool XMLMatchSign(const pugi::xml_node& node, const XMLSign& sign)
{
	if (node.name() != sign.name) return 0;

	for (auto& a : sign.attributes)
	{
		auto att = node.attribute(a.first.c_str());
		
		if (!att) return 0;

		if (att.value() != a.second) return 0;
	}
	
	return 1;
}

std::vector<pugi::xml_node> XMLFind(const pugi::xml_node& startNode, const XMLSign& sign)
{
	std::vector<pugi::xml_node> ret;

	std::vector<pugi::xml_node> stack;

	stack.push_back(startNode);

	while (!stack.empty())
	{
		auto cur = stack.back();
		stack.pop_back();

		if (XMLMatchSign(cur, sign))
		{
			ret.push_back(cur);
		}
		
		auto& childs = cur.children();

		for (auto& child : childs)
		{
			stack.push_back(child);
		}
	}

	return ret;
}

//without tag
std::string XMLInnerText(pugi::xml_node target)
{
	pugi::xml_node child = target.first_child();

	if (child)
	{
		std::string ret;

		for (; child; child = child.next_sibling())
		{
			ret += XMLInnerText(child);
		}

		return ret;
	}
	else
	{
		std::string str = target.text().as_string();

		if (!str.empty())
		{
			while (!str.empty() && (str.back() == '\n' || str.back() == '\t' || str.back() == ' '))
			{
				str.pop_back();
			}

			if (str.back() != ' ') str.push_back(' ');
		}

		return str;
	}
	
}


//return true on susccess
bool ParseHTML(pugi::xml_document& outDoc, const char* html, size_t length)
{
	const char htmlDocTag[] = "<!DOCTYPE html>";
	const size_t htmlDocTagLength = sizeof(htmlDocTag) - 1;

	if (length < htmlDocTagLength) return false;

	//std::cout << html + htmlDocTagLength << "\n";

	TidyDoc tidyDoc = tidyCreate();
	TidyBuffer tidyOutputBuffer = { 0 };
	tidyOptSetBool(tidyDoc, TidyXmlOut, yes)
		&& tidyOptSetBool(tidyDoc, TidyQuiet, yes)
		&& tidyOptSetBool(tidyDoc, TidyNumEntities, yes)
		&& tidyOptSetBool(tidyDoc, TidyShowWarnings, no)
		&& tidyOptSetInt(tidyDoc, TidyWrapLen, 0);
	tidyParseString(tidyDoc, html);
	tidyCleanAndRepair(tidyDoc);
	tidySaveBuffer(tidyDoc, &tidyOutputBuffer);
	if (!tidyOutputBuffer.bp) 
	{
		return false;
	}
	std::string tidyResult;
	tidyResult = (char*)tidyOutputBuffer.bp;
	tidyBufFree(&tidyOutputBuffer);

	pugi::xml_parse_result result = outDoc.load_buffer(tidyResult.c_str(), tidyResult.size());

	tidyRelease(tidyDoc);

	if (!result)
	{
		std::cout << result.description() << "\n";
		return false;
	}

	//doc.save(std::cout);

	return true;
}

inline std::string GetProtocol(const std::string& url)
{
	auto id = url.find("://");

	if (id == std::string::npos) return "";

	return url.substr(0, id);
}

ParsedArticle ParseBaoMoiContent(const pugi::xml_document& doc)
{
	auto root = doc.root();

	ParsedArticle ret;

	auto title = XMLFind(root,
		{
			"h1",
			{
				{ "class", "bm_L" }
			}
		}
	);
	ret.title = XMLInnerText(title.front());

	auto content = XMLFind(root,
		{
			"p",
			{
				{ "class", "bm_V" }
			}
		}
	);

	auto& retContent = ret.content;
	for (auto& it = content.rbegin(); it != content.rend(); it++)
	{
		retContent += XMLInnerText(*it);
		retContent += "\n";
	}
	if (!retContent.empty()) retContent.pop_back();

	auto author = XMLFind(root,
		{
			"p",
			{
				{ "class", "bm_V bm_Cg" }
			}
		}
	);
	auto& retAuthor = ret.author;
	for (auto& it = author.rbegin(); it != author.rend(); it++)
	{
		retAuthor += XMLInnerText(*it);
		retAuthor += "\n";
	}
	if (!retAuthor.empty()) retAuthor.pop_back();


	auto url = XMLFind(root,
		{
			"link",
			{
				{ "rel", "canonical" }
			}
		}
	);
	ret.URL = url.front().attribute("href").value();

	return ret;
}

void ParseBaoMoiExternalLinks(const pugi::xml_document& doc, std::vector<std::string>& links)
{
	auto root = doc.root();

	auto externalLink = XMLFind(root,
		{
			"a",
			{
			}
		}
	);
	for (auto& it = externalLink.rbegin(); it != externalLink.rend(); it++)
	{
		std::string link = it->attribute("href").value();

		auto protocol = GetProtocol(link);

		if (protocol == "https")
		{
			links.push_back(link);
		}
		else
		{
			links.push_back("https://baomoi.com" + link);
		}
	}
}


void Hello(const v8::FunctionCallbackInfo<v8::Value>& args) 
{
	v8::Isolate* isolate = args.GetIsolate();
	auto message = v8::String::NewFromUtf8(isolate, "Hello world from C++").ToLocalChecked();
	args.GetReturnValue().Set(message);
}

#define JsString(str) v8::String::NewFromUtf8(isolate, str).ToLocalChecked()

inline void MakeJSParsedArticle(
	v8::Isolate* isolate,
	v8::Local<v8::Context> context,
	v8::Local<v8::Object> target, 
	const std::string& url, 
	const std::string& title, 
	const std::string& content,
	const std::string& author,
	const std::vector<std::string>& links
	)
{
	target->Set(context, JsString("URL"), JsString(url.c_str()));
	target->Set(context, JsString("title"), JsString(title.c_str()));
	target->Set(context, JsString("content"), JsString(content.c_str()));
	target->Set(context, JsString("author"), JsString(author.c_str()));

	std::vector<v8::Local<v8::Value>> jsLinks;

	for (auto& link : links)
	{
		jsLinks.push_back(JsString(link.c_str()));
	}

	auto arr = v8::Array::New(isolate, &jsLinks[0], jsLinks.size());

	target->Set(context, JsString("URLs"), arr);
}


#define BEGIN_PARSE()																			\
v8::Isolate* isolate = args.GetIsolate();														\
if (args.Length() != 1 || !args[0]->IsString())													\
{																								\
	isolate->ThrowException(JsString("Native function \'Parser\' input must be a string"));		\
	return;																						\
}																								\
auto context = isolate->GetCurrentContext();													\
auto jsstr = args[0]->ToString(context).ToLocalChecked();										\
v8::String::Utf8Value utf8str(isolate, jsstr);													\
auto str = *utf8str;																			\
size_t length = utf8str.length();



void ParseArticle(const v8::FunctionCallbackInfo<v8::Value>& args)
{
	BEGIN_PARSE();
	
	//=======================================start parse=========================================================
	pugi::xml_document doc;
	if (!ParseHTML(doc, str, length))
	{
		isolate->ThrowException(JsString("HTML invalid"));
		return;
	}

	std::vector<std::string> links;
	ParseBaoMoiExternalLinks(doc, links);
	auto ret = ParseBaoMoiContent(doc);


	//======================================return to js side=====================================================
	auto obj = v8::Object::New(isolate);
	MakeJSParsedArticle(isolate, context, obj, ret.URL, ret.title, ret.content, ret.author, links);
	args.GetReturnValue().Set(obj);
}

void ParseExternalLinks(const v8::FunctionCallbackInfo<v8::Value>& args)
{
	BEGIN_PARSE();


	//=======================================start parse=========================================================
	pugi::xml_document doc;
	if (!ParseHTML(doc, str, length))
	{
		isolate->ThrowException(JsString("HTML invalid"));
		return;
	}

	std::vector<std::string> links;
	ParseBaoMoiExternalLinks(doc, links);


	//======================================return to js side=====================================================
	std::vector<v8::Local<v8::Value>> jsLinks;

	for (auto& link : links)
	{
		jsLinks.push_back(JsString(link.c_str()));
	}

	auto arr = v8::Array::New(isolate, &jsLinks[0], jsLinks.size());
	args.GetReturnValue().Set(arr);
}

void Initialize(v8::Local<v8::Object> exports) 
{
	std::cout.imbue(std::locale("en_US.utf8"));

#ifdef _WIN32
	SetConsoleCP(65001);
	SetConsoleOutputCP(65001);
	HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
	if (hOut == INVALID_HANDLE_VALUE)
	{
		exit(-1);
	}

	DWORD dwMode = 0;
	if (!GetConsoleMode(hOut, &dwMode))
	{
		exit(-1);
	}

	dwMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
	if (!SetConsoleMode(hOut, dwMode))
	{
		exit(-1);
	}
#endif

	NODE_SET_METHOD(exports, "Hello", Hello);
	NODE_SET_METHOD(exports, "ParseArticle", ParseArticle);
	NODE_SET_METHOD(exports, "ParseExternalLinks", ParseExternalLinks);
}

NODE_MODULE(module_name, Initialize)