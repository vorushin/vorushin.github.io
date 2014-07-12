import json


def post_filename(entry):
	fields = entry["fields"]
	return fields["pub_date"][:10] + "-" + fields["slug"] + ".md"


def post_text(entry):
	fields = entry["fields"]
	s = """---
layout: post
title: %s
permalink: /blog/%s-%s
---
%s""" % (fields["title"], entry["pk"], fields["slug"], fields["text_markdown"])
	return s.encode("utf-8")


def import_from_json_file(json_filename):
	with open(json_filename) as f:
		entries = json.load(f)
		for entry in entries:
			with open("_posts/" + post_filename(entry), "w") as post_f:
				post_f.write(post_text(entry))