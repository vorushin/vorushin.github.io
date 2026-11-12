#!/usr/bin/env ruby
# The one invariant of the Magic Cats story data that nothing else enforces: every paragraph has the
# same number of " || " beats in English, German and Russian (the game shows beat i of each language
# in step), no beat is empty, and no marker sits at the very start or end of a paragraph.
#   ruby _tools/magic_cats_check.rb        (exit 1 and a message when something is off)
require 'yaml'
data = YAML.load_file(File.expand_path('../_data/magic_cats.yml', __dir__))
langs = data['langs']
bad = []
total = 0
data['sections'].each do |section|
  section['paragraphs'].each_with_index do |p, pi|
    counts = langs.map { |l| (p[l] || '').split(' || ').length }
    where = "#{section['id']} paragraph #{pi + 1}"
    bad << "#{where}: beat counts differ #{langs.zip(counts).to_h}" if counts.uniq.length > 1
    langs.each do |l|
      txt = p[l] || ''
      bad << "#{where} (#{l}): missing text" if txt.strip.empty?
      bad << "#{where} (#{l}): marker at the edge" if txt.start_with?('||') || txt.end_with?('||')
      bad << "#{where} (#{l}): empty beat" if txt.split(' || ').any? { |b| b.strip.empty? }
    end
    total += counts.first
  end
end
if bad.empty?
  puts "magic_cats.yml ok: #{data['sections'].sum { |s| s['paragraphs'].length }} paragraphs, #{total} beats per language"
else
  puts bad
  exit 1
end
