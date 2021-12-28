{
  "targets": [
    {
      "target_name": "HTMLParser",
      "include_dirs": [
        "src/addons/Libs/pugixml/",
        "src/addons/Libs/tinyxml2/",
        "src/addons/Libs/tidy/include/",
      ],
      "sources": [ 
        "src/addons/src/HTMLParser.cpp",
        "src/addons/Libs/pugixml/pugixml.cpp",
        "src/addons/Libs/tinyxml2/tinyxml2.cpp",
      ],
      'libraries': [
        "-l../src/addons/Libs/tidy/lib/tidy.lib"
      ],
    }
  ]
}